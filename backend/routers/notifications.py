from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from typing import List
from pydantic import BaseModel
from database import get_database
from routers.auth import get_current_user
from utils.push_notifications import send_push_notification, get_user_device_tokens, register_device_token

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# Base URL for constructing full image URLs
# Change this to your actual backend URL
BASE_URL = "https://api.cofau.com"


def get_full_url(relative_url: str) -> str:
    """Convert relative URL to full URL if needed"""
    if not relative_url:
        return None
    if relative_url.startswith("http"):
        return relative_url
    return f"{BASE_URL}{relative_url}"


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
    Types: "like", "comment", "follow", "new_post", "message", "compliment", "wallet_reward", "order_preparing", "order_in_progress"
    """
    # Don't notify yourself (except for wallet rewards and order notifications)
    if from_user_id == to_user_id and notification_type not in ["wallet_reward", "order_preparing", "order_in_progress"]:
        return None

    # Get from_user details - check both users and restaurants collections
    from_user = await db.users.find_one({"_id": ObjectId(from_user_id)})

    # If not found in users, check restaurants collection
    if not from_user:
        from_user = await db.restaurants.find_one({"_id": ObjectId(from_user_id)})
        # Use restaurant_name instead of full_name for restaurants
        if from_user and "restaurant_name" in from_user:
            from_user["full_name"] = from_user["restaurant_name"]

    if not from_user:
        return None
    
    # ============================================
    # ✅ GET POST THUMBNAIL WHEN CREATING NOTIFICATION
    # ============================================
    post_thumbnail = None
    if post_id:
        try:
            post = await db.posts.find_one({"_id": ObjectId(post_id)})
            if post:
                media_type = post.get("media_type", "image")
                # For videos, prefer thumbnail_url; for images, use media_url
                if media_type == "video":
                    post_thumbnail = post.get("thumbnail_url") or post.get("media_url")
                else:
                    post_thumbnail = post.get("media_url") or post.get("image_url")
                print(f"📷 Post thumbnail for notification: {post_thumbnail}")
        except Exception as e:
            print(f"⚠️ Error fetching post for thumbnail: {e}")
    
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
        elif notification_type == "compliment":
            message = f"{from_user['full_name']} sent you a compliment"
        elif notification_type == "story_like":
            message = f"{from_user['full_name']} liked your story"
        elif notification_type == "wallet_reward":
            message = "Congratulations! Wallet reward earned"
    
    notification_doc = {
        "type": notification_type,
        "fromUserId": from_user_id,
        "fromUserName": from_user.get("full_name", "Someone"),
        "fromUserProfilePicture": from_user.get("profile_picture"),
        "fromUserLevel": from_user.get("level", 1),
        "toUserId": to_user_id,
        "postId": post_id,
        "postThumbnail": post_thumbnail,
        "message": message,
        "isRead": False,
        "createdAt": datetime.utcnow(),
    }
    
    result = await db.notifications.insert_one(notification_doc)
    notification_id = str(result.inserted_id)
    
    print(f"✅ Notification created: {notification_type}")
    print(f"   From: {from_user['full_name']} ({from_user_id})")
    print(f"   To: {to_user_id}")
    print(f"   PostThumbnail: {post_thumbnail}")
    
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
                elif notification_type == "story_like":
                    title = "Story Like"
                elif notification_type == "wallet_reward":
                    title = "Wallet Reward"
                elif notification_type == "order_preparing":
                    title = "Order In Progress"
                elif notification_type == "order_in_progress":
                    title = "Order Update"
                
                await send_push_notification(
                    device_tokens=device_tokens,
                    title=title,
                    body=message,
                    data=notification_data,
                    user_id=to_user_id
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
    
    # Fetch notifications (exclude messages - they go to chat)
    cursor = db.notifications.find(
        {"toUserId": user_id, "type": {"$ne": "message"}}
    ).sort("createdAt", -1).skip(skip).limit(limit)
    
    notifications = await cursor.to_list(length=limit)
    
    # Enrich with user details and post thumbnail
    result = []
    for notif in notifications:
        # Check if we have cached user data in notification
        from_user_name = notif.get("fromUserName")
        from_user_profile_picture = notif.get("fromUserProfilePicture")
        from_user_level = notif.get("fromUserLevel", 1)
        
        # If not cached, fetch from database (for old notifications)
        if not from_user_name:
            from_user = await db.users.find_one({"_id": ObjectId(notif["fromUserId"])})
            if from_user:
                from_user_name = from_user.get("full_name", "Unknown User")
                from_user_profile_picture = from_user.get("profile_picture")
                from_user_level = from_user.get("level", 1)
            else:
                from_user_name = "Unknown User"
        
        # Get post thumbnail - first check if saved in notification
        post_thumbnail = notif.get("postThumbnail")
        
        # If not saved, fetch from post (for old notifications)
        if not post_thumbnail and notif.get("postId"):
            try:
                post = await db.posts.find_one({"_id": ObjectId(notif["postId"])})
                if post:
                    media_type = post.get("media_type", "image")
                    if media_type == "video":
                        post_thumbnail = post.get("thumbnail_url") or post.get("media_url")
                    else:
                        post_thumbnail = post.get("media_url") or post.get("image_url")
            except:
                pass
        
        # Convert to full URL if it's a relative path
        if post_thumbnail:
            post_thumbnail = get_full_url(post_thumbnail)
        if from_user_profile_picture:
            from_user_profile_picture = get_full_url(from_user_profile_picture)
        
        notif_data = {
            "id": str(notif["_id"]),
            "type": notif["type"],
            "fromUserId": notif["fromUserId"],
            "fromUserName": from_user_name,
            "fromUserProfilePicture": from_user_profile_picture,
            "fromUserLevel": from_user_level,
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
        "isRead": False,
        "type": {"$ne": "message"}
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


@router.post("/backfill-thumbnails")
async def backfill_notification_thumbnails(current_user: dict = Depends(get_current_user)):
    """
    One-time migration to add postThumbnail and user details to existing notifications.
    Call this once after deploying to fix old notifications.
    """
    db = get_database()
    
    # Find notifications that need updating
    notifications = await db.notifications.find({
        "postId": {"$ne": None}
    }).to_list(None)
    
    print(f"📷 Found {len(notifications)} notifications to check for backfill")
    
    updated = 0
    for notif in notifications:
        update_fields = {}
        
        # Check if postThumbnail needs updating
        if not notif.get("postThumbnail"):
            post_id = notif.get("postId")
            if post_id:
                try:
                    post = await db.posts.find_one({"_id": ObjectId(post_id)})
                    if post:
                        media_type = post.get("media_type", "image")
                        if media_type == "video":
                            thumbnail = post.get("thumbnail_url") or post.get("media_url")
                        else:
                            thumbnail = post.get("media_url") or post.get("image_url")
                        
                        if thumbnail:
                            update_fields["postThumbnail"] = thumbnail
                except Exception as e:
                    print(f"⚠️ Error getting post thumbnail: {e}")
        
        # Check if user details need updating
        if not notif.get("fromUserName"):
            from_user_id = notif.get("fromUserId")
            if from_user_id:
                try:
                    from_user = await db.users.find_one({"_id": ObjectId(from_user_id)})
                    if from_user:
                        update_fields["fromUserName"] = from_user.get("full_name", "Unknown")
                        update_fields["fromUserProfilePicture"] = from_user.get("profile_picture")
                        update_fields["fromUserLevel"] = from_user.get("level", 1)
                except Exception as e:
                    print(f"⚠️ Error getting user details: {e}")
        
        # Update if we have fields to update
        if update_fields:
            await db.notifications.update_one(
                {"_id": notif["_id"]},
                {"$set": update_fields}
            )
            updated += 1
    
    print(f"✅ Updated {updated} notifications")
    return {
        "message": f"Backfilled {updated} notifications",
        "total_checked": len(notifications),
        "updated": updated
    }