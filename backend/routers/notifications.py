from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from typing import List
from pydantic import BaseModel
from database import get_database
from routers.auth import get_current_user
from utils.push_notifications import send_push_notification, get_user_device_tokens, register_device_token

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def create_notification(
    db,
    notification_type: str,
    from_user_id: str,
    to_user_id: str,
    post_id: str = None,
    message: str = None,
    send_push: bool = True
):
    """
    Helper function to create a notification and optionally send push notification.
    Types: "like", "comment", "follow", "new_post", "message", "compliment"
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
        elif notification_type == "message":
            message = f"{from_user['full_name']} sent you a message"
    
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
    notification_id = str(result.inserted_id)
    
    # Send push notification if enabled
    if send_push:
        try:
            print(f"🔔 Creating {notification_type} notification: {from_user_id} -> {to_user_id}")
            device_tokens = await get_user_device_tokens(to_user_id)
            
            if device_tokens:
                print(f"📱 Found {len(device_tokens)} device token(s) for recipient")
                # Prepare notification data for navigation
                notification_data = {
                    "type": notification_type,
                    "fromUserId": from_user_id,
                    "fromUserName": from_user.get("full_name", "Someone"),
                    "notificationId": notification_id,
                }
                
                if post_id:
                    notification_data["postId"] = post_id
                
                # Determine title based on type
                title = "New Notification"
                if notification_type == "message":
                    title = "New Message"
                elif notification_type == "like":
                    title = "New Like"
                elif notification_type == "comment":
                    title = "New Comment"
                elif notification_type == "follow":
                    title = "New Follower"
                elif notification_type == "new_post":
                    title = "New Post"
                elif notification_type == "compliment":
                    title = "New Compliment"
                
                await send_push_notification(
                    device_tokens=device_tokens,
                    title=title,
                    body=message,
                    data=notification_data
                )
            else:
                print(f"⚠️ No device tokens found for user {to_user_id} - push notification skipped")
                print(f"   User needs to register their device token via /api/notifications/register-device")
        except Exception as e:
            print(f"⚠️ Error sending push notification: {str(e)}")
            import traceback
            traceback.print_exc()
    
    return notification_id


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


class DeviceTokenRequest(BaseModel):
    deviceToken: str
    platform: str = "unknown"


@router.post("/register-device")
async def register_device(
    request: DeviceTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """Register device token for push notifications"""
    user_id = str(current_user["_id"])
    
    if not request.deviceToken:
        raise HTTPException(status_code=400, detail="Device token is required")
    
    print(f"📱 Registering device token for user {user_id}")
    print(f"   Platform: {request.platform}")
    print(f"   Token: {request.deviceToken[:50]}...")
    
    success = await register_device_token(
        user_id=user_id,
        device_token=request.deviceToken,
        platform=request.platform
    )
    
    if success:
        # Verify the token was actually stored
        tokens = await get_user_device_tokens(user_id)
        token_count = len(tokens)
        print(f"✅ Device token registration completed. User now has {token_count} device token(s)")
        
        return {
            "success": True,
            "message": "Device registered successfully",
            "tokenCount": token_count
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Failed to register device token. Please try again."
        )
