from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from typing import List
from database import get_database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def create_notification(
    db,
    notification_type: str,
    from_user_id: str,
    to_user_id: str,
    post_id: str = None,
    message: str = None
):
    """
    Helper function to create a notification.
    Types: "like", "comment", "follow", "new_post"
    """
    # Don't notify yourself
    if from_user_id == to_user_id:
        return None
    
    # Get from_user details
    from_user = await db.users.find_one({"_id": ObjectId(from_user_id)})
    if not from_user:
        return None
    
    # Generate default message if not provided
    if not message:
        if notification_type == "like":
            message = f"{from_user['full_name']} liked your post"
        elif notification_type == "comment":
            message = f"{from_user['full_name']} commented on your post"
        elif notification_type == "follow":
            message = f"{from_user['full_name']} started following you"
        elif notification_type == "new_post":
            message = f"{from_user['full_name']} uploaded a new post"
    
    notification_doc = {
        "type": notification_type,
        "fromUserId": from_user_id,
        "toUserId": to_user_id,
        "postId": post_id,
        "message": message,
        "isRead": False,
        "createdAt": datetime.utcnow(),
    }
    
    result = await db.notifications.insert_one(notification_doc)
    return str(result.inserted_id)


@router.get("")
async def get_notifications(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for current user"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    # Fetch notifications
    cursor = db.notifications.find(
        {"toUserId": user_id}
    ).sort("createdAt", -1).skip(skip).limit(limit)
    
    notifications = await cursor.to_list(length=limit)
    
    # Enrich with user details and post thumbnail
    result = []
    for notif in notifications:
        from_user = await db.users.find_one({"_id": ObjectId(notif["fromUserId"])})
        
        # Get post thumbnail if notification is related to a post
        post_thumbnail = None
        if notif.get("postId"):
            post = await db.posts.find_one({"_id": ObjectId(notif["postId"])})
            if post:
                post_thumbnail = post.get("media_url")
        
        notif_data = {
            "id": str(notif["_id"]),
            "type": notif["type"],
            "fromUserId": notif["fromUserId"],
            "fromUserName": from_user["full_name"] if from_user else "Unknown User",
            "fromUserProfilePicture": from_user.get("profile_picture") if from_user else None,
            "fromUserLevel": from_user.get("level", 1) if from_user else 1,
            "postId": notif.get("postId"),
            "postThumbnail": post_thumbnail,
            "message": notif["message"],
            "isRead": notif["isRead"],
            "createdAt": notif["createdAt"],
        }
        result.append(notif_data)
    
    return result


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    count = await db.notifications.count_documents({
        "toUserId": user_id,
        "isRead": False
    })
    
    return {"unreadCount": count}


@router.post("/mark-read")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    result = await db.notifications.update_many(
        {"toUserId": user_id, "isRead": False},
        {"$set": {"isRead": True}}
    )
    
    return {"modifiedCount": result.modified_count}


@router.post("/{notification_id}/mark-read")
async def mark_notification_as_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a specific notification as read"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "toUserId": user_id},
        {"$set": {"isRead": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}
