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
        
    Returns:
        Optional[dict]: Response from Expo API, or None if failed
    """
    if not device_tokens:
        print("⚠️ No device tokens provided for push notification")
        return None
    
    # Filter out invalid tokens
    valid_tokens = [str(token).strip() for token in device_tokens if token and str(token).strip()]
    
    if not valid_tokens:
        print("⚠️ No valid device tokens after filtering")
        return None
    
    messages = []
    for token in valid_tokens:
        # Configure message for both foreground and background delivery
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "channelId": "default",
            # Ensure notification shows even when app is closed
            "badge": 1,  # Set badge count (can be updated by app)
        }
        
        # Additional configuration for Android
        # These ensure notifications work when app is in background or closed
        message["android"] = {
            "priority": "high",
            "channelId": "default",
            "sound": "default",
        }
        
        # Additional configuration for iOS
        message["ios"] = {
            "sound": "default",
            "badge": 1,
        }
        
        messages.append(message)
    
    try:
        print(f"📤 Sending push notification to {len(messages)} device(s)")
        print(f"   Title: {title}")
        print(f"   Body: {body}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_API_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                timeout=10.0
            )
            response.raise_for_status()
            response_data = response.json()
            print(f"✅ Push notification sent successfully to {len(messages)} device(s)")
            
            # Log any errors from Expo
            if "data" in response_data:
                for receipt in response_data.get("data", []):
                    if receipt.get("status") == "error":
                        print(f"⚠️ Expo push error: {receipt.get('message', 'Unknown error')}")
            
            return response_data
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error sending push notification: {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        return None
    except Exception as e:
        print(f"❌ Error sending push notification: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


async def get_user_device_tokens(user_id: str) -> List[str]:
    """
    Get all device tokens for a user
    
    Args:
        user_id: User ID
        
    Returns:
        List of device tokens
    """
    try:
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            print(f"⚠️ User {user_id} not found when retrieving device tokens")
            return []
        
        # Get device tokens from user document
        device_tokens = user.get("device_tokens", [])
        
        # Filter out None/empty tokens and ensure they're strings
        valid_tokens = [str(token) for token in device_tokens if token and str(token).strip()]
        
        if valid_tokens:
            print(f"📱 Found {len(valid_tokens)} device token(s) for user {user_id}")
        else:
            print(f"⚠️ No valid device tokens found for user {user_id}")
        
        return valid_tokens
    except Exception as e:
        print(f"❌ Error getting device tokens for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


async def register_device_token(user_id: str, device_token: str, platform: str = "unknown"):
    """
    Register a device token for a user
    
    Args:
        user_id: User ID
        device_token: Expo push token
        platform: Platform (ios, android, web)
        
    Returns:
        bool: True if token was successfully registered (or already exists)
    """
    if not device_token:
        print(f"⚠️ Empty device token provided for user {user_id}")
        return False
    
    db = get_database()
    
    try:
        # Verify user exists first
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            print(f"❌ User {user_id} not found when registering device token")
            return False
        
        # Check if token already exists
        existing_tokens = user.get("device_tokens", [])
        token_exists = device_token in existing_tokens
        
        # Add token to user's device_tokens array (avoid duplicates)
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$addToSet": {"device_tokens": device_token},
                "$set": {"last_device_platform": platform}
            }
        )
        
        # Verify the update succeeded by checking matched_count
        if result.matched_count > 0:
            if result.modified_count > 0:
                print(f"✅ Device token registered for user {user_id} (platform: {platform})")
                print(f"   Token: {device_token[:50]}...")
            elif token_exists:
                print(f"ℹ️ Device token already registered for user {user_id}")
            else:
                # Token was already there (race condition or duplicate)
                print(f"ℹ️ Device token verified for user {user_id}")
            return True
        else:
            print(f"❌ Failed to register device token - user not found: {user_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error registering device token for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

