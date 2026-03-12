import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
from datetime import datetime, timedelta
from database import get_database
from utils.hashing import hash_password, verify_password
from utils.jwt import create_access_token, verify_token
from utils.level_system import recalculate_points_from_post_count
from config import settings
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["Admin"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/login")


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminCreate(BaseModel):
    username: str
    password: str
    name: str


async def get_current_admin(token: str = Depends(oauth2_scheme)):
    """Verify that the token belongs to an admin user"""
    email = verify_token(token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = get_database()
    admin = await db.admins.find_one({"username": email})
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized as admin",
        )

    return admin


@router.post("/login")
async def admin_login(credentials: AdminLogin):
    """Admin login with username and password"""
    db = get_database()

    admin = await db.admins.find_one({"username": credentials.username})
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not verify_password(credentials.password, admin["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(data={"sub": admin["username"]})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "admin": {
            "id": str(admin["_id"]),
            "username": admin["username"],
            "name": admin.get("name", admin["username"]),
        },
    }


@router.get("/me")
async def admin_me(current_admin: dict = Depends(get_current_admin)):
    """Get current admin profile"""
    return {
        "id": str(current_admin["_id"]),
        "username": current_admin["username"],
        "name": current_admin.get("name", current_admin["username"]),
    }


@router.get("/stats")
async def admin_stats(current_admin: dict = Depends(get_current_admin)):
    """Get admin dashboard stats"""
    db = get_database()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    total_users = await db.users.count_documents({})
    total_posts = await db.posts.count_documents({})
    total_restaurants = await db.restaurants.count_documents({})
    pending_badges = await db.badge_requests.count_documents({"status": "pending"})
    approved_badges = await db.badge_requests.count_documents({"status": "approved"})
    pending_vouchers = await db.voucher_claims.count_documents({"status": "pending"})
    total_vouchers = await db.voucher_claims.count_documents({})
    new_users_30d = await db.users.count_documents({"created_at": {"$gte": thirty_days_ago}})

    return {
        "total_users": total_users,
        "total_posts": total_posts,
        "total_restaurants": total_restaurants,
        "pending_badges": pending_badges,
        "approved_badges": approved_badges,
        "pending_vouchers": pending_vouchers,
        "total_vouchers": total_vouchers,
        "new_users_30d": new_users_30d,
    }


@router.get("/voucher-claims")
async def get_voucher_claims(
    status_filter: str = "all",
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin),
):
    """Get voucher claims list (admin only)"""
    db = get_database()

    query = {}
    if status_filter != "all":
        query["status"] = status_filter

    cursor = (
        db.voucher_claims.find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    claims = []
    async for claim in cursor:
        # Fetch user data
        user = None
        try:
            from bson import ObjectId
            user = await db.users.find_one({"_id": ObjectId(claim["user_id"])})
        except Exception:
            pass

        claims.append({
            "id": str(claim["_id"]),
            "user_id": claim.get("user_id"),
            "username": claim.get("username", ""),
            "user_email": claim.get("user_email", ""),
            "user_phone": claim.get("user_phone", ""),
            "wallet_balance": claim.get("wallet_balance", 0),
            "amount_deducted": claim.get("amount_deducted", 500),
            "status": claim.get("status", "pending"),
            "email_sent": claim.get("email_sent", True),
            "created_at": claim["created_at"].isoformat() if claim.get("created_at") else None,
            "profile_picture": user.get("profile_picture") if user else None,
            "full_name": user.get("full_name", "") if user else claim.get("username", ""),
            "level": user.get("level", 1) if user else None,
            "total_points": user.get("total_points", 0) if user else None,
        })

    total = await db.voucher_claims.count_documents(query)

    return {"claims": claims, "total": total}


@router.post("/voucher-claims/{claim_id}/process")
async def process_voucher_claim(
    claim_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Mark a voucher claim as processed (admin only)"""
    db = get_database()

    from bson import ObjectId

    try:
        claim = await db.voucher_claims.find_one({"_id": ObjectId(claim_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid claim ID")

    if not claim:
        raise HTTPException(status_code=404, detail="Voucher claim not found")

    await db.voucher_claims.update_one(
        {"_id": ObjectId(claim_id)},
        {
            "$set": {
                "status": "processed",
                "processed_at": datetime.utcnow(),
                "processed_by": current_admin.get("username"),
            }
        },
    )

    # Notify user
    try:
        notification = {
            "to_user_id": claim["user_id"],
            "type": "voucher_processed",
            "title": "Voucher Sent!",
            "message": "Your Amazon voucher has been processed and sent to your email.",
            "read": False,
            "created_at": datetime.utcnow(),
        }
        await db.notifications.insert_one(notification)
    except Exception:
        pass

    return {"message": "Voucher claim marked as processed"}


@router.get("/new-users")
async def get_new_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin),
):
    """Get users who signed up in the last 30 days"""
    db = get_database()

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    cursor = (
        db.users.find({"created_at": {"$gte": thirty_days_ago}})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    users = []
    async for user in cursor:
        users.append({
            "user_id": str(user["_id"]),
            "full_name": user.get("full_name", ""),
            "username": user.get("username", ""),
            "email": user.get("email", ""),
            "phone_number": user.get("phone_number", ""),
            "profile_picture": user.get("profile_picture"),
            "level": user.get("level", 1),
            "total_points": user.get("total_points", 0),
            "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
        })

    total = await db.users.count_documents({"created_at": {"$gte": thirty_days_ago}})

    return {"users": users, "total": total}


@router.get("/users/{username}/posts")
async def get_user_posts_by_username(
    username: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_admin: dict = Depends(get_current_admin),
):
    """Get all posts by a specific username (admin only)"""
    db = get_database()

    # Find the user by username (normalize same as signup: lowercase, no spaces)
    normalized = username.lower().strip().replace(" ", "")
    user = await db.users.find_one({"username": normalized})
    # Fallback: case-insensitive regex search
    if not user:
        import re
        user = await db.users.find_one({"username": {"$regex": f"^{re.escape(normalized)}$", "$options": "i"}})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = str(user["_id"])

    cursor = (
        db.posts.find({"user_id": user_id})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )

    posts = []
    async for post in cursor:
        posts.append({
            "id": str(post["_id"]),
            "user_id": post.get("user_id"),
            "username": username,
            "media_url": post.get("media_url") or post.get("image_url"),
            "media_type": post.get("media_type"),
            "rating": post.get("rating"),
            "review_text": post.get("review_text"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "created_at": post["created_at"].isoformat() if post.get("created_at") else None,
        })

    total = await db.posts.count_documents({"user_id": user_id})

    return {
        "user": {
            "user_id": user_id,
            "username": user.get("username"),
            "full_name": user.get("full_name"),
            "email": user.get("email"),
        },
        "posts": posts,
        "total": total,
    }


@router.delete("/posts/{post_id}")
async def admin_delete_post(
    post_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Delete any user's post (admin only)"""
    db = get_database()

    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_id = post.get("user_id")

    # Delete the media file from server
    media_url = post.get("media_url") or post.get("image_url")
    if media_url:
        try:
            if "/api/static/uploads/" in media_url:
                filename = media_url.split("/api/static/uploads/")[-1]
                file_path = os.path.join(settings.UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
        except Exception as e:
            print(f"Warning: Error deleting media file: {e}")

    # Delete related data
    await db.likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.saved_posts.delete_many({"post_id": post_id})

    # Delete the post
    result = await db.posts.delete_one({"_id": ObjectId(post_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Failed to delete post")

    # Recalculate user points
    if user_id:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            remaining_posts = await db.posts.count_documents({"user_id": user_id})
            level_update = recalculate_points_from_post_count(remaining_posts)
            await db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "total_points": level_update["total_points"],
                    "points": level_update["total_points"],
                    "level": level_update["level"],
                    "currentPoints": level_update["currentPoints"],
                    "requiredPoints": level_update["requiredPoints"],
                    "title": level_update["title"],
                }}
            )

    return {
        "message": "Post deleted successfully by admin",
        "deleted_post_id": post_id,
        "deleted_by": current_admin.get("username"),
    }
