#!/usr/bin/env python3
"""
Test script to verify Firebase FCM setup is working correctly.
Run this script to test Firebase initialization and sending capabilities.
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.firebase_fcm import initialize_firebase, send_fcm_notification, is_fcm_token


async def test_firebase_initialization():
    """Test if Firebase can be initialized"""
    print("=" * 60)
    print("Testing Firebase Initialization...")
    print("=" * 60)
    
    try:
        app = initialize_firebase()
        print("✅ Firebase Admin SDK initialized successfully!")
        print(f"   App name: {app.name}")
        return True
    except Exception as e:
        print(f"❌ Firebase initialization failed: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Check FIREBASE_CREDENTIALS_PATH environment variable")
        print("2. Verify the service account JSON file exists and is valid")
        print("3. Check file permissions")
        return False


def test_token_detection():
    """Test token type detection"""
    print("\n" + "=" * 60)
    print("Testing Token Type Detection...")
    print("=" * 60)
    
    # Test Expo token (iOS)
    expo_token = "ExponentPushToken[xxxxxxxxxxxxx]"
    is_fcm = is_fcm_token(expo_token)
    print(f"Expo token: {expo_token[:30]}...")
    print(f"   Detected as FCM: {is_fcm} (Expected: False) ✅" if not is_fcm else f"   Detected as FCM: {is_fcm} (Expected: False) ❌")
    
    # Test FCM token (Android)
    fcm_token = "cXyZ123abc456def789ghi012jkl345mno678pqr901stu234vwx567yz"
    is_fcm = is_fcm_token(fcm_token)
    print(f"FCM token: {fcm_token[:30]}...")
    print(f"   Detected as FCM: {is_fcm} (Expected: True) ✅" if is_fcm else f"   Detected as FCM: {is_fcm} (Expected: True) ❌")


async def test_send_notification(fcm_token: str = None):
    """Test sending a notification (requires valid FCM token)"""
    print("\n" + "=" * 60)
    print("Testing FCM Notification Sending...")
    print("=" * 60)
    
    if not fcm_token:
        print("⚠️  No FCM token provided. Skipping send test.")
        print("   To test sending, provide a token:")
        print("   python3 test_firebase.py --token YOUR_FCM_TOKEN")
        return
    
    print(f"Sending test notification to: {fcm_token[:50]}...")
    
    try:
        result = await send_fcm_notification(
            device_tokens=[fcm_token],
            title="Test Notification",
            body="This is a test notification from Firebase FCM",
            data={"test": "true", "type": "test"}
        )
        
        print(f"\n📊 Send Result:")
        print(f"   Success: {result.get('success', 0)}")
        print(f"   Failure: {result.get('failure', 0)}")
        
        if result.get('success', 0) > 0:
            print("✅ Notification sent successfully!")
        else:
            print("❌ Notification failed to send")
            if result.get('errors'):
                print("   Errors:")
                for error in result.get('errors', []):
                    print(f"     - {error}")
    except Exception as e:
        print(f"❌ Error sending notification: {str(e)}")
        import traceback
        traceback.print_exc()


async def main():
    """Main test function"""
    print("\n" + "=" * 60)
    print("Firebase FCM Setup Test")
    print("=" * 60 + "\n")
    
    # Test 1: Initialization
    init_success = await test_firebase_initialization()
    
    if not init_success:
        print("\n❌ Firebase initialization failed. Please fix this first.")
        sys.exit(1)
    
    # Test 2: Token detection
    test_token_detection()
    
    # Test 3: Send notification (if token provided)
    import argparse
    parser = argparse.ArgumentParser(description='Test Firebase FCM setup')
    parser.add_argument('--token', type=str, help='FCM token to test sending')
    args = parser.parse_args()
    
    if args.token:
        await test_send_notification(args.token)
    else:
        await test_send_notification()
    
    print("\n" + "=" * 60)
    print("✅ All tests completed!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
