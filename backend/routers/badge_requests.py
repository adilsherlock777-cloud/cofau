from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from routers.admin_auth import get_current_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/badge", tags=["Badge Requests"])


class BadgeRequestCreate(BaseModel):
    reason: Optional[str] = None


# ======================================================
# USER ENDPOINTS
# ======================================================

@router.post("/request")
async def create_badge_request(
    body: BadgeRequestCreate,
    current_user: dict = Depends(get_current_user),
):
    """User or restaurant submits a badge request"""
    db = get_database()
    user_id = str(current_user["_id"])
    account_type = current_user.get("account_type", "user")

    # Check if already has a verified badge
    if current_user.get("badge") == "verified" or current_user.get("is_verified"):
        raise HTTPException(status_code=400, detail="You already have a verified badge")

    # Check if there's already a pending request
    existing = await db.badge_requests.find_one(
        {"user_id": user_id, "status": "pending"}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending badge request")

    request_doc = {
        "user_id": user_id,
        "account_type": account_type,
        "username": current_user.get("username", "") or current_user.get("restaurant_name", ""),
        "full_name": current_user.get("full_name", "") or current_user.get("restaurant_name", ""),
        "profile_picture": current_user.get("profile_picture"),
        "level": current_user.get("level", 1),
        "total_points": current_user.get("total_points", 0),
        "followers_count": current_user.get("followers_count", 0),
        "reason": body.reason,
        "status": "pending",
        "requested_at": datetime.utcnow(),
        "reviewed_at": None,
        "reviewed_by": None,
    }

    await db.badge_requests.insert_one(request_doc)

    return {"message": "Badge request submitted successfully", "status": "pending"}


@router.get("/request/status")
async def get_badge_request_status(current_user: dict = Depends(get_current_user)):
    """Get user's badge request status"""
    db = get_database()
    user_id = str(current_user["_id"])

    # Find most recent request
    request = await db.badge_requests.find_one(
        {"user_id": user_id},
        sort=[("requested_at", -1)],
    )

    if not request:
        return {"status": "none", "badge": current_user.get("badge")}

    return {
        "status": request["status"],
        "badge": current_user.get("badge"),
        "requested_at": request["requested_at"].isoformat() if request.get("requested_at") else None,
        "reviewed_at": request["reviewed_at"].isoformat() if request.get("reviewed_at") else None,
        "reject_reason": request.get("reject_reason"),
    }


# ======================================================
# ADMIN ENDPOINTS
# ======================================================

@router.get("/admin/requests")
async def get_badge_requests(
    status_filter: str = "pending",
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin),
):
    """Get badge requests (admin only)"""
    db = get_database()

    query = {}
    if status_filter != "all":
        query["status"] = status_filter

    cursor = (
        db.badge_requests.find(query)
        .sort("requested_at", -1)
        .skip(skip)
        .limit(limit)
    )

    requests = []
    async for req in cursor:
        # Fetch latest user data (try users first, then restaurants)
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(req["user_id"])})
            if user is None:
                user = await db.restaurants.find_one({"_id": ObjectId(req["user_id"])})
        except Exception:
            user = None

        post_count = await db.posts.count_documents({"user_id": req["user_id"]})

        requests.append({
            "id": str(req["_id"]),
            "user_id": req["user_id"],
            "username": user.get("username", req.get("username", "")) if user else req.get("username", ""),
            "full_name": user.get("full_name", req.get("full_name", "")) if user else req.get("full_name", ""),
            "profile_picture": user.get("profile_picture") if user else req.get("profile_picture"),
            "level": user.get("level", 1) if user else req.get("level", 1),
            "total_points": user.get("total_points", 0) if user else req.get("total_points", 0),
            "followers_count": user.get("followers_count", 0) if user else req.get("followers_count", 0),
            "post_count": post_count,
            "account_type": req.get("account_type", "user"),
            "reason": req.get("reason"),
            "status": req["status"],
            "requested_at": req["requested_at"].isoformat() if req.get("requested_at") else None,
            "reviewed_at": req["reviewed_at"].isoformat() if req.get("reviewed_at") else None,
            "reviewed_by": req.get("reviewed_by"),
        })

    total = await db.badge_requests.count_documents(query)

    return {"requests": requests, "total": total}


class ReviewAction(BaseModel):
    reject_reason: Optional[str] = None


@router.post("/admin/requests/{request_id}/approve")
async def approve_badge_request(
    request_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Approve a badge request (admin only)"""
    db = get_database()

    try:
        badge_request = await db.badge_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not badge_request:
        raise HTTPException(status_code=404, detail="Badge request not found")

    if badge_request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    # Update badge request status
    await db.badge_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "approved",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": current_admin.get("username"),
            }
        },
    )

    # Set badge on user or restaurant
    try:
        account_type = badge_request.get("account_type", "user")
        collection = db.restaurants if account_type == "restaurant" else db.users
        update_fields = {"badge": "verified"}
        if account_type == "restaurant":
            update_fields["is_verified"] = True
        await collection.update_one(
            {"_id": ObjectId(badge_request["user_id"])},
            {"$set": update_fields},
        )
    except Exception:
        pass

    # Send notification to user
    try:
        notification = {
            "to_user_id": badge_request["user_id"],
            "type": "badge_approved",
            "title": "Badge Approved!",
            "message": "Congratulations! Your Cofau verified badge has been approved.",
            "read": False,
            "created_at": datetime.utcnow(),
        }
        await db.notifications.insert_one(notification)
    except Exception:
        pass

    return {"message": "Badge request approved", "status": "approved"}


@router.post("/admin/requests/{request_id}/reject")
async def reject_badge_request(
    request_id: str,
    body: ReviewAction,
    current_admin: dict = Depends(get_current_admin),
):
    """Reject a badge request (admin only)"""
    db = get_database()

    try:
        badge_request = await db.badge_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not badge_request:
        raise HTTPException(status_code=404, detail="Badge request not found")

    if badge_request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    await db.badge_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "rejected",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": current_admin.get("username"),
                "reject_reason": body.reject_reason,
            }
        },
    )

    # Send notification to user
    try:
        reason_text = f" Reason: {body.reject_reason}" if body.reject_reason else ""
        notification = {
            "to_user_id": badge_request["user_id"],
            "type": "badge_rejected",
            "title": "Badge Request Update",
            "message": f"Your Cofau badge request was not approved at this time.{reason_text}",
            "read": False,
            "created_at": datetime.utcnow(),
        }
        await db.notifications.insert_one(notification)
    except Exception:
        pass

    return {"message": "Badge request rejected", "status": "rejected"}


@router.post("/admin/requests/{request_id}/revoke")
async def revoke_badge(
    request_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Revoke a user's badge (admin only)"""
    db = get_database()

    try:
        badge_request = await db.badge_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request ID")

    if not badge_request:
        raise HTTPException(status_code=404, detail="Badge request not found")

    # Remove badge from user or restaurant
    try:
        account_type = badge_request.get("account_type", "user")
        collection = db.restaurants if account_type == "restaurant" else db.users
        update_fields = {"badge": None}
        if account_type == "restaurant":
            update_fields["is_verified"] = False
        await collection.update_one(
            {"_id": ObjectId(badge_request["user_id"])},
            {"$set": update_fields},
        )
    except Exception:
        pass

    # Update request status
    await db.badge_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "revoked",
                "reviewed_at": datetime.utcnow(),
                "reviewed_by": current_admin.get("username"),
            }
        },
    )

    return {"message": "Badge revoked", "status": "revoked"}
