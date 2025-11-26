import httpx
from typing import List, Optional
from database import get_database
from bson import ObjectId

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_notification(
    device_tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None
):
    """
    Send push notification to Expo devices
    
    Args:
        device_tokens: List of Expo push tokens
        title: Notification title
        body: Notification body
        data: Additional data to send with notification
    """
    if not device_tokens:
        return
    
    messages = []
    for token in device_tokens:
        messages.append({
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "default",
        })
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_API_URL,
                json={"messages": messages},
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                timeout=10.0
            )
            response.raise_for_status()
            print(f"✅ Push notification sent to {len(device_tokens)} device(s)")
            return response.json()
    except Exception as e:
        print(f"❌ Error sending push notification: {str(e)}")
        return None


async def get_user_device_tokens(user_id: str) -> List[str]:
    """
    Get all device tokens for a user
    
    Args:
        user_id: User ID
        
    Returns:
        List of device tokens
    """
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        return []
    
    # Get device tokens from user document
    device_tokens = user.get("device_tokens", [])
    
    # Filter out None/empty tokens
    return [token for token in device_tokens if token]


async def register_device_token(user_id: str, device_token: str, platform: str = "unknown"):
    """
    Register a device token for a user
    
    Args:
        user_id: User ID
        device_token: Expo push token
        platform: Platform (ios, android, web)
    """
    db = get_database()
    
    # Add token to user's device_tokens array (avoid duplicates)
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$addToSet": {"device_tokens": device_token},
            "$set": {"last_device_platform": platform}
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Device token registered for user {user_id}")
    else:
        print(f"ℹ️ Device token already registered for user {user_id}")
    
    return result.modified_count > 0

