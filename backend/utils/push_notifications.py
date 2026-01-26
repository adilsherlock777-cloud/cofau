import httpx
from typing import List, Optional, Dict, Tuple
from database import get_database
from bson import ObjectId
from utils.firebase_fcm import send_fcm_notification, is_fcm_token, initialize_firebase

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


async def send_expo_push_notification(
    device_tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None
):
    """
    Send push notification to iOS devices via Expo Push Notification service.
    
    Args:
        device_tokens: List of Expo push tokens (iOS devices)
        title: Notification title
        body: Notification body
        data: Additional data to send with notification
        
    Returns:
        Optional[dict]: Response from Expo API, or None if failed
    """
    if not device_tokens:
        print("⚠️ No Expo device tokens provided for push notification")
        return None
    
    # Filter out invalid tokens
    valid_tokens = [str(token).strip() for token in device_tokens if token and str(token).strip()]
    
    if not valid_tokens:
        print("⚠️ No valid Expo device tokens after filtering")
        return None
    
    messages = []
    for token in valid_tokens:
        # Configure message for iOS devices
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
            "priority": "high",
            "badge": 1,
            "_displayInForeground": True,
            "mutableContent": True,
        }

        # Additional configuration for iOS
        message["ios"] = {
            "sound": "default",
            "badge": 1,
        }

        messages.append(message)
    
    try:
        print(f"📤 Sending Expo push notification to {len(messages)} iOS device(s)")
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
            print(f"✅ Expo push notification sent successfully to {len(messages)} iOS device(s)")
            
            # Log any errors from Expo
            if "data" in response_data:
                for receipt in response_data.get("data", []):
                    if receipt.get("status") == "error":
                        print(f"⚠️ Expo push error: {receipt.get('message', 'Unknown error')}")
            
            return response_data
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error sending Expo push notification: {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        return None
    except Exception as e:
        print(f"❌ Error sending Expo push notification: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def separate_tokens_by_platform(device_tokens: List[str], user_platforms: Optional[Dict[str, str]] = None) -> Tuple[List[str], List[str]]:
    """
    Separate device tokens into iOS (Expo) and Android (FCM) tokens.
    
    Args:
        device_tokens: List of device tokens
        user_platforms: Optional dict mapping token to platform (for stored platform info)
        
    Returns:
        Tuple of (ios_tokens, android_tokens)
    """
    ios_tokens = []
    android_tokens = []
    
    for token in device_tokens:
        if not token or not str(token).strip():
            continue
        
        token_str = str(token).strip()
        
        # Check if we have stored platform info for this token
        if user_platforms and token_str in user_platforms:
            platform = user_platforms[token_str].lower()
            if platform == "ios":
                ios_tokens.append(token_str)
            elif platform == "android":
                android_tokens.append(token_str)
            continue
        
        # Detect platform from token format
        # Expo tokens start with "ExponentPushToken["
        if token_str.startswith("ExponentPushToken["):
            ios_tokens.append(token_str)
        elif is_fcm_token(token_str):
            android_tokens.append(token_str)
        else:
            # Default to iOS (Expo) for backward compatibility
            # This handles old tokens that might not have platform info
            print(f"⚠️ Unknown token format, defaulting to iOS (Expo): {token_str[:50]}...")
            ios_tokens.append(token_str)
    
    return ios_tokens, android_tokens


async def send_push_notification(
    device_tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    user_id: Optional[str] = None
):
    """
    Send push notification to devices, routing Android to FCM and iOS to Expo.
    
    Args:
        device_tokens: List of device tokens (can be mix of Expo and FCM tokens)
        title: Notification title
        body: Notification body
        data: Additional data to send with notification
        user_id: Optional user ID to get platform info from database
        
    Returns:
        Dict with results from both services
    """
    if not device_tokens:
        print("⚠️ No device tokens provided for push notification")
        return None
    
    # Filter out invalid tokens
    valid_tokens = [str(token).strip() for token in device_tokens if token and str(token).strip()]
    
    if not valid_tokens:
        print("⚠️ No valid device tokens after filtering")
        return None
    
    # Get platform info from database if user_id is provided
    user_platforms = None
    if user_id:
        try:
            db = get_database()
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                # Get device_tokens_with_platform if it exists
                # For now, we'll detect from token format
                pass
        except Exception as e:
            print(f"⚠️ Error getting user platform info: {str(e)}")
    
    # Separate tokens by platform
    ios_tokens, android_tokens = separate_tokens_by_platform(valid_tokens, user_platforms)
    
    print(f"📱 Token distribution: {len(ios_tokens)} iOS (Expo), {len(android_tokens)} Android (FCM)")
    
    results = {
        "ios": None,
        "android": None,
        "total_sent": 0
    }
    
    # Send to iOS devices via Expo
    if ios_tokens:
        try:
            expo_result = await send_expo_push_notification(
                device_tokens=ios_tokens,
                title=title,
                body=body,
                data=data
            )
            results["ios"] = expo_result
            if expo_result:
                results["total_sent"] += len(ios_tokens)
        except Exception as e:
            print(f"❌ Error sending Expo notifications: {str(e)}")
            results["ios"] = {"error": str(e)}
    
    # Send to Android devices via FCM
    if android_tokens:
        try:
            # Initialize Firebase if not already done
            try:
                initialize_firebase()
            except Exception as e:
                print(f"⚠️ Firebase initialization warning: {str(e)}")
            
            fcm_result = await send_fcm_notification(
                device_tokens=android_tokens,
                title=title,
                body=body,
                data=data
            )
            results["android"] = fcm_result
            if fcm_result and "success" in fcm_result:
                results["total_sent"] += fcm_result.get("success", 0)
        except Exception as e:
            print(f"❌ Error sending FCM notifications: {str(e)}")
            results["android"] = {"error": str(e)}
    
    return results


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
    Register a device token for a user.
    IMPORTANT: Removes token from other users first to prevent duplicate notifications.
    
    Args:
        user_id: User ID
        device_token: Device push token (Expo for iOS, FCM for Android)
        platform: Platform (ios, android, web)
        
    Returns:
        bool: True if token was successfully registered
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
        
        # Normalize platform
        platform_lower = platform.lower() if platform else "unknown"
        
        # Auto-detect platform from token if not provided
        if platform_lower == "unknown":
            if device_token.startswith("ExponentPushToken["):
                platform_lower = "ios"
                print(f"🔍 Auto-detected platform as iOS from token format")
            elif is_fcm_token(device_token):
                platform_lower = "android"
                print(f"🔍 Auto-detected platform as Android from token format")
        
        # ✅ IMPORTANT: Remove this token from ALL other users first
        # This prevents the same device from receiving notifications for multiple accounts
        remove_result = await db.users.update_many(
            {
                "_id": {"$ne": ObjectId(user_id)},  # All users EXCEPT current user
                "device_tokens": device_token
            },
            {"$pull": {"device_tokens": device_token}}
        )
        
        if remove_result.modified_count > 0:
            print(f"🧹 Removed device token from {remove_result.modified_count} other user(s)")
        
        # Now add token to current user's device_tokens array (avoid duplicates)
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$addToSet": {"device_tokens": device_token},
                "$set": {"last_device_platform": platform_lower}
            }
        )
        
        if result.matched_count > 0:
            if result.modified_count > 0:
                print(f"✅ Device token registered for user {user_id} (platform: {platform_lower})")
                print(f"   Token: {device_token[:50]}...")
            else:
                print(f"ℹ️ Device token already registered for user {user_id}")
            return True
        else:
            print(f"❌ Failed to register device token - user not found: {user_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error registering device token for user {user_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
