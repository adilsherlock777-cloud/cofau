"""
Firebase Cloud Messaging (FCM) service for Android push notifications.
This module handles sending push notifications to Android devices via Firebase.
iOS devices continue to use Expo Push Notifications.
"""
import os
from typing import List, Optional, Dict
from dotenv import load_dotenv

load_dotenv()

# Optional Firebase import - server can start even if firebase-admin is not installed
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    credentials = None
    messaging = None

# Initialize Firebase Admin SDK (only once)
_firebase_app = None


def initialize_firebase():
    """
    Initialize Firebase Admin SDK.
    This should be called once when the application starts.
    
    Uses hardcoded path: /root/backend/backend/secrets/cofau-23116-firebase-adminsdk-fbsvc-ed3d669985.json
    """
    global _firebase_app
    
    if not FIREBASE_AVAILABLE:
        raise ImportError("firebase-admin package is not installed. Install with: pip install firebase-admin")
    
    if _firebase_app is not None:
        # Already initialized
        return _firebase_app
    
    try:
        # Check if Firebase is already initialized
        firebase_admin.get_app()
        print("✅ Firebase Admin SDK already initialized")
        return firebase_admin.get_app()
    except ValueError:
        # Not initialized yet, proceed with initialization
        pass
    
    # Hardcoded path - no environment variable needed
    cred_path = "/root/backend/backend/secrets/cofau-23116-firebase-adminsdk-fbsvc-ed3d669985.json"
    
    # Verify file exists
    if not os.path.exists(cred_path):
        error_msg = f"❌ Firebase credentials file not found at: {cred_path}"
        print(error_msg)
        raise FileNotFoundError(error_msg)
    
    cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    
    if cred_path and os.path.exists(cred_path):
        # Load from file path
        print(f"📁 Loading Firebase credentials from: {cred_path}")
        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized from file")
    elif cred_json:
        # Load from JSON string
        import json
        print("📄 Loading Firebase credentials from environment variable")
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
        _firebase_app = firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized from JSON")
    else:
        # Try default initialization (uses GOOGLE_APPLICATION_CREDENTIALS)
        print("⚠️ No Firebase credentials found in environment variables")
        print("   Attempting default initialization...")
        try:
            _firebase_app = firebase_admin.initialize_app()
            print("✅ Firebase Admin SDK initialized with default credentials")
        except Exception as e:
            print(f"❌ Failed to initialize Firebase Admin SDK: {str(e)}")
            print("   Please set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON environment variable")
            raise
    
    return _firebase_app


async def send_fcm_notification(
    device_tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict] = None
) -> Dict:
    """
    Send push notification to Android devices via Firebase Cloud Messaging.
    
    Args:
        device_tokens: List of FCM device tokens (Android only)
        title: Notification title
        body: Notification body
        data: Additional data payload (optional)
        
    Returns:
        Dict with success count and any errors
    """
    if not device_tokens:
        print("⚠️ No FCM device tokens provided")
        return {"success": 0, "failure": 0, "errors": []}
    
    # Initialize Firebase if not already done
    try:
        initialize_firebase()
    except Exception as e:
        print(f"❌ Failed to initialize Firebase: {str(e)}")
        return {"success": 0, "failure": len(device_tokens), "errors": [str(e)]}
    
    # Filter out invalid tokens
    valid_tokens = [str(token).strip() for token in device_tokens if token and str(token).strip()]
    
    if not valid_tokens:
        print("⚠️ No valid FCM device tokens after filtering")
        return {"success": 0, "failure": 0, "errors": []}
    
    print(f"📤 Sending FCM notification to {len(valid_tokens)} Android device(s)")
    print(f"   Title: {title}")
    print(f"   Body: {body}")
    
    success_count = 0
    failure_count = 0
    errors = []
    
    # FCM supports sending to multiple devices via multicast
    # But we'll send individually to track each device's status
    for token in valid_tokens:
        try:
            # Convert data to strings (FCM requires all data values to be strings)
            fcm_data = {}
            if data:
                for key, value in data.items():
                    # Convert all values to strings for FCM
                    if isinstance(value, (dict, list)):
                        import json
                        fcm_data[str(key)] = json.dumps(value)
                    else:
                        fcm_data[str(key)] = str(value) if value is not None else ""
            
            # Create the message
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=fcm_data,
                token=token,
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        channel_id="default",
                        sound="default",
                        priority="max",
                        vibrate_timings_millis=[0, 250, 250, 250],
                        visibility="public",
                    ),
                ),
            )
            
            # Send the message
            response = messaging.send(message)
            print(f"✅ FCM notification sent successfully: {response}")
            success_count += 1
            
        except messaging.UnregisteredError:
            print(f"⚠️ FCM token is unregistered (device may have uninstalled app): {token[:50]}...")
            failure_count += 1
            errors.append(f"Token {token[:50]}... is unregistered")
        except messaging.InvalidArgumentError as e:
            print(f"❌ Invalid FCM token: {token[:50]}... - {str(e)}")
            failure_count += 1
            errors.append(f"Invalid token {token[:50]}...: {str(e)}")
        except Exception as e:
            print(f"❌ Error sending FCM notification to {token[:50]}...: {str(e)}")
            failure_count += 1
            errors.append(f"Error for token {token[:50]}...: {str(e)}")
    
    print(f"📊 FCM notification results: {success_count} success, {failure_count} failure")
    
    return {
        "success": success_count,
        "failure": failure_count,
        "errors": errors
    }


def is_fcm_token(token: str) -> bool:
    """
    Check if a token is an FCM token (Android) or Expo token (iOS).
    
    FCM tokens are typically longer and don't start with "ExponentPushToken"
    Expo tokens start with "ExponentPushToken["
    
    Args:
        token: Device token string
        
    Returns:
        True if token appears to be an FCM token (Android), False if Expo token (iOS)
    """
    if not token:
        return False
    
    token_str = str(token).strip()
    
    # Expo tokens start with "ExponentPushToken["
    if token_str.startswith("ExponentPushToken["):
        return False
    
    # FCM tokens are typically longer base64-like strings
    # They don't have the Expo prefix
    return True
