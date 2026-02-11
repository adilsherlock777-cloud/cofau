from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from routers.notifications import create_notification

router = APIRouter(prefix="/api/users", tags=["follow"])


@router.post("/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Can't follow yourself
    if current_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if target user exists
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already following
    existing_follow = await db.follows.find_one({
        "followerId": current_user_id,
        "followingId": user_id
    })
    
    if existing_follow:
        return {"message": "Already following", "isFollowing": True}
    
    # Create follow relationship
    follow_doc = {
        "followerId": current_user_id,
        "followingId": user_id,
        "createdAt": datetime.utcnow()
    }
    await db.follows.insert_one(follow_doc)
    
    # Update follower counts
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"following_count": 1}}
    )
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"followers_count": 1}}
    )
    
    # Create notification
    await create_notification(
        db=db,
        notification_type="follow",
        from_user_id=current_user_id,
        to_user_id=user_id
    )
    
    return {"message": "Followed successfully", "isFollowing": True}


@router.delete("/{user_id}/follow")
async def unfollow_user_delete(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user (DELETE method)"""
    return await _unfollow_user(user_id, current_user)


@router.post("/{user_id}/unfollow")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    return await _unfollow_user(user_id, current_user)


async def _unfollow_user(user_id: str, current_user: dict):
    """Shared unfollow logic"""
    db = get_database()
    current_user_id = str(current_user["_id"])

    # Delete follow relationship
    result = await db.follows.delete_one({
        "followerId": current_user_id,
        "followingId": user_id
    })

    if result.deleted_count == 0:
        return {"message": "Not following", "isFollowing": False}

    # Update follower counts
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"following_count": -1}}
    )
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"followers_count": -1}}
    )

    return {"message": "Unfollowed successfully", "isFollowing": False}


@router.get("/{user_id}/follow-status")
async def get_follow_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check if current user is following the specified user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Can't follow yourself
    if current_user_id == user_id:
        return {"isFollowing": False, "isSelf": True}
    
    follow = await db.follows.find_one({
        "followerId": current_user_id,
        "followingId": user_id
    })
    
    return {"isFollowing": follow is not None, "isSelf": False}
