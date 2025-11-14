#!/usr/bin/env python3
"""
Comprehensive Notifications System Testing
Tests the complete notifications flow end-to-end as requested.
"""

import requests
import json
import time
import os
from datetime import datetime

# Base URL from environment
BASE_URL = "https://backend.cofau.com/api"

class NotificationsTestSuite:
    def __init__(self):
        self.base_url = BASE_URL
        self.user_a_token = None
        self.user_b_token = None
        self.user_a_id = None
        self.user_b_id = None
        self.post_id = None
        self.timestamp = str(int(time.time()))
        
    def log(self, message):
        """Log test messages with timestamp"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def make_request(self, method, endpoint, headers=None, data=None, files=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                if files:
                    response = requests.post(url, headers=headers, data=data, files=files)
                else:
                    response = requests.post(url, headers=headers, json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            
            self.log(f"{method} {endpoint} -> {response.status_code}")
            return response
        except Exception as e:
            self.log(f"❌ Request failed: {e}")
            return None
    
    def test_1_create_test_users(self):
        """TEST 1: CREATE TEST USERS"""
        self.log("🧪 TEST 1: Creating test users...")
        
        # Create User A (content creator)
        user_a_data = {
            "full_name": "User A",
            "email": f"notif_user_a_{self.timestamp}@test.com",
            "password": "TestPass123!"
        }
        
        response = self.make_request("POST", "/auth/signup", data=user_a_data)
        if response and response.status_code == 200:
            self.user_a_token = response.json()["access_token"]
            self.log("✅ User A created successfully")
        else:
            self.log(f"❌ User A creation failed: {response.text if response else 'No response'}")
            return False
        
        # Get User A profile to get ID
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("GET", "/auth/me", headers=headers)
        if response and response.status_code == 200:
            self.user_a_id = response.json()["id"]
            self.log(f"✅ User A ID: {self.user_a_id}")
        else:
            self.log("❌ Failed to get User A profile")
            return False
        
        # Create User B (follower)
        user_b_data = {
            "full_name": "User B",
            "email": f"notif_user_b_{self.timestamp}@test.com",
            "password": "TestPass123!"
        }
        
        response = self.make_request("POST", "/auth/signup", data=user_b_data)
        if response and response.status_code == 200:
            self.user_b_token = response.json()["access_token"]
            self.log("✅ User B created successfully")
        else:
            self.log(f"❌ User B creation failed: {response.text if response else 'No response'}")
            return False
        
        # Get User B profile to get ID
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        response = self.make_request("GET", "/auth/me", headers=headers)
        if response and response.status_code == 200:
            self.user_b_id = response.json()["id"]
            self.log(f"✅ User B ID: {self.user_b_id}")
        else:
            self.log("❌ Failed to get User B profile")
            return False
        
        return True
    
    def test_2_user_b_follows_user_a(self):
        """TEST 2: USER B FOLLOWS USER A"""
        self.log("🧪 TEST 2: User B follows User A...")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        response = self.make_request("POST", f"/users/{self.user_a_id}/follow", headers=headers)
        
        if response and response.status_code == 200:
            self.log("✅ Follow request successful")
            
            # Verify notification created for User A
            headers_a = {"Authorization": f"Bearer {self.user_a_token}"}
            response = self.make_request("GET", "/notifications", headers=headers_a)
            
            if response and response.status_code == 200:
                notifications = response.json()
                self.log(f"📋 User A has {len(notifications)} notifications")
                
                if len(notifications) >= 1:
                    follow_notif = notifications[0]  # Latest notification
                    self.log(f"📋 Notification details: {json.dumps(follow_notif, indent=2)}")
                    
                    # Verify notification fields
                    checks = [
                        (follow_notif.get("type") == "follow", "type: follow"),
                        (follow_notif.get("fromUserName") == "User B", "fromUserName: User B"),
                        ("started following you" in follow_notif.get("message", ""), "message contains 'started following you'"),
                        (follow_notif.get("isRead") == False, "isRead: false"),
                        (follow_notif.get("fromUserLevel") == 1, "fromUserLevel: 1")
                    ]
                    
                    all_passed = True
                    for check, desc in checks:
                        if check:
                            self.log(f"✅ {desc}")
                        else:
                            self.log(f"❌ {desc}")
                            all_passed = False
                    
                    return all_passed
                else:
                    self.log("❌ No follow notification found")
                    return False
            else:
                self.log(f"❌ Failed to get notifications: {response.text if response else 'No response'}")
                return False
        else:
            self.log(f"❌ Follow request failed: {response.text if response else 'No response'}")
            return False
    
    def test_3_get_unread_count_user_a(self):
        """TEST 3: GET UNREAD COUNT FOR USER A"""
        self.log("🧪 TEST 3: Getting unread count for User A...")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("GET", "/notifications/unread-count", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            unread_count = data.get("unreadCount", 0)
            self.log(f"📋 Unread count: {unread_count}")
            
            if unread_count == 1:
                self.log("✅ Unread count is correct (1)")
                return True
            else:
                self.log(f"❌ Expected unread count 1, got {unread_count}")
                return False
        else:
            self.log(f"❌ Failed to get unread count: {response.text if response else 'No response'}")
            return False
    
    def test_4_user_a_creates_post(self):
        """TEST 4: USER A CREATES A POST"""
        self.log("🧪 TEST 4: User A creates a post...")
        
        # Create a test image file
        test_image_content = b"fake_image_data_for_testing"
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        data = {
            "rating": "9",
            "review_text": "Amazing burger! The patty was juicy and perfectly cooked. Highly recommend!",
            "map_link": "https://maps.google.com/?q=Times+Square,New+York"
        }
        files = {
            "file": ("test_image.jpg", test_image_content, "image/jpeg")
        }
        
        response = self.make_request("POST", "/posts/create", headers=headers, data=data, files=files)
        
        if response and response.status_code == 200:
            result = response.json()
            self.post_id = result.get("post_id")
            self.log(f"✅ Post created successfully, ID: {self.post_id}")
            
            # Verify new_post notification for User B
            headers_b = {"Authorization": f"Bearer {self.user_b_token}"}
            response = self.make_request("GET", "/notifications", headers=headers_b)
            
            if response and response.status_code == 200:
                notifications = response.json()
                self.log(f"📋 User B has {len(notifications)} notifications")
                
                if len(notifications) >= 1:
                    new_post_notif = notifications[0]  # Latest notification
                    self.log(f"📋 Notification details: {json.dumps(new_post_notif, indent=2)}")
                    
                    # Verify notification fields
                    checks = [
                        (new_post_notif.get("type") == "new_post", "type: new_post"),
                        (new_post_notif.get("fromUserName") == "User A", "fromUserName: User A"),
                        (new_post_notif.get("postId") == self.post_id, f"postId: {self.post_id}"),
                        (new_post_notif.get("postThumbnail") is not None, "postThumbnail exists"),
                        ("uploaded a new post" in new_post_notif.get("message", ""), "message contains 'uploaded a new post'"),
                        (new_post_notif.get("isRead") == False, "isRead: false")
                    ]
                    
                    all_passed = True
                    for check, desc in checks:
                        if check:
                            self.log(f"✅ {desc}")
                        else:
                            self.log(f"❌ {desc}")
                            all_passed = False
                    
                    return all_passed
                else:
                    self.log("❌ No new_post notification found")
                    return False
            else:
                self.log(f"❌ Failed to get User B notifications: {response.text if response else 'No response'}")
                return False
        else:
            self.log(f"❌ Post creation failed: {response.text if response else 'No response'}")
            return False
    
    def test_5_user_b_likes_post(self):
        """TEST 5: USER B LIKES USER A'S POST"""
        self.log("🧪 TEST 5: User B likes User A's post...")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        response = self.make_request("POST", f"/posts/{self.post_id}/like", headers=headers)
        
        if response and response.status_code == 200:
            self.log("✅ Like successful")
            
            # Verify like notification for User A
            headers_a = {"Authorization": f"Bearer {self.user_a_token}"}
            response = self.make_request("GET", "/notifications", headers=headers_a)
            
            if response and response.status_code == 200:
                notifications = response.json()
                self.log(f"📋 User A has {len(notifications)} notifications")
                
                if len(notifications) >= 2:
                    like_notif = notifications[0]  # Latest notification
                    self.log(f"📋 Latest notification details: {json.dumps(like_notif, indent=2)}")
                    
                    # Verify notification fields
                    checks = [
                        (like_notif.get("type") == "like", "type: like"),
                        (like_notif.get("fromUserName") == "User B", "fromUserName: User B"),
                        (like_notif.get("postId") == self.post_id, f"postId: {self.post_id}"),
                        (like_notif.get("postThumbnail") is not None, "postThumbnail exists"),
                        ("liked your post" in like_notif.get("message", ""), "message contains 'liked your post'"),
                        (like_notif.get("isRead") == False, "isRead: false")
                    ]
                    
                    all_passed = True
                    for check, desc in checks:
                        if check:
                            self.log(f"✅ {desc}")
                        else:
                            self.log(f"❌ {desc}")
                            all_passed = False
                    
                    return all_passed
                else:
                    self.log("❌ Expected at least 2 notifications (follow + like)")
                    return False
            else:
                self.log(f"❌ Failed to get User A notifications: {response.text if response else 'No response'}")
                return False
        else:
            self.log(f"❌ Like request failed: {response.text if response else 'No response'}")
            return False
    
    def test_6_user_b_comments_on_post(self):
        """TEST 6: USER B COMMENTS ON USER A'S POST"""
        self.log("🧪 TEST 6: User B comments on User A's post...")
        
        headers = {"Authorization": f"Bearer {self.user_b_token}"}
        # Use form data instead of JSON for comment endpoint
        data = {"comment_text": "Great post!"}
        
        # Use requests directly to send form data
        url = f"{self.base_url}/posts/{self.post_id}/comment"
        try:
            response = requests.post(url, headers=headers, data=data)
            self.log(f"POST /posts/{self.post_id}/comment -> {response.status_code}")
        except Exception as e:
            self.log(f"❌ Request failed: {e}")
            response = None
        
        if response and response.status_code == 200:
            self.log("✅ Comment created successfully")
            
            # Verify comment notification for User A
            headers_a = {"Authorization": f"Bearer {self.user_a_token}"}
            response = self.make_request("GET", "/notifications", headers=headers_a)
            
            if response and response.status_code == 200:
                notifications = response.json()
                self.log(f"📋 User A has {len(notifications)} notifications")
                
                if len(notifications) >= 3:
                    comment_notif = notifications[0]  # Latest notification
                    self.log(f"📋 Latest notification details: {json.dumps(comment_notif, indent=2)}")
                    
                    # Verify notification fields
                    checks = [
                        (comment_notif.get("type") == "comment", "type: comment"),
                        (comment_notif.get("fromUserName") == "User B", "fromUserName: User B"),
                        (comment_notif.get("postId") == self.post_id, f"postId: {self.post_id}"),
                        (comment_notif.get("postThumbnail") is not None, "postThumbnail exists"),
                        ("commented on your post" in comment_notif.get("message", ""), "message contains 'commented on your post'"),
                        (comment_notif.get("isRead") == False, "isRead: false")
                    ]
                    
                    all_passed = True
                    for check, desc in checks:
                        if check:
                            self.log(f"✅ {desc}")
                        else:
                            self.log(f"❌ {desc}")
                            all_passed = False
                    
                    return all_passed
                else:
                    self.log("❌ Expected at least 3 notifications (follow + like + comment)")
                    return False
            else:
                self.log(f"❌ Failed to get User A notifications: {response.text if response else 'No response'}")
                return False
        else:
            self.log(f"❌ Comment creation failed: {response.text if response else 'No response'}")
            return False
    
    def test_7_check_user_a_unread_count(self):
        """TEST 7: CHECK USER A'S UNREAD COUNT"""
        self.log("🧪 TEST 7: Checking User A's unread count...")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("GET", "/notifications/unread-count", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            unread_count = data.get("unreadCount", 0)
            self.log(f"📋 Unread count: {unread_count}")
            
            if unread_count == 3:
                self.log("✅ Unread count is correct (3: follow + like + comment)")
                return True
            else:
                self.log(f"❌ Expected unread count 3, got {unread_count}")
                return False
        else:
            self.log(f"❌ Failed to get unread count: {response.text if response else 'No response'}")
            return False
    
    def test_8_mark_specific_notification_read(self):
        """TEST 8: MARK SPECIFIC NOTIFICATION AS READ"""
        self.log("🧪 TEST 8: Marking specific notification as read...")
        
        # Get notifications to find first notification ID
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("GET", "/notifications", headers=headers)
        
        if response and response.status_code == 200:
            notifications = response.json()
            if len(notifications) >= 1:
                first_notif_id = notifications[-1]["id"]  # Get oldest notification (follow)
                self.log(f"📋 Marking notification {first_notif_id} as read")
                
                # Mark as read
                response = self.make_request("POST", f"/notifications/{first_notif_id}/mark-read", headers=headers)
                
                if response and response.status_code == 200:
                    self.log("✅ Notification marked as read")
                    
                    # Verify it's marked as read
                    response = self.make_request("GET", "/notifications", headers=headers)
                    if response and response.status_code == 200:
                        notifications = response.json()
                        marked_notif = next((n for n in notifications if n["id"] == first_notif_id), None)
                        
                        if marked_notif and marked_notif.get("isRead") == True:
                            self.log("✅ Notification is marked as read")
                            return True
                        else:
                            self.log("❌ Notification is not marked as read")
                            return False
                    else:
                        self.log("❌ Failed to verify notification status")
                        return False
                else:
                    self.log(f"❌ Failed to mark notification as read: {response.text if response else 'No response'}")
                    return False
            else:
                self.log("❌ No notifications found")
                return False
        else:
            self.log(f"❌ Failed to get notifications: {response.text if response else 'No response'}")
            return False
    
    def test_9_mark_all_notifications_read(self):
        """TEST 9: MARK ALL NOTIFICATIONS AS READ"""
        self.log("🧪 TEST 9: Marking all notifications as read...")
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("POST", "/notifications/mark-read", headers=headers)
        
        if response and response.status_code == 200:
            data = response.json()
            modified_count = data.get("modifiedCount", 0)
            self.log(f"📋 Modified count: {modified_count}")
            
            if modified_count == 2:  # Should be 2 remaining unread (like + comment)
                self.log("✅ Correct number of notifications marked as read")
                
                # Verify unread count is now 0
                response = self.make_request("GET", "/notifications/unread-count", headers=headers)
                if response and response.status_code == 200:
                    data = response.json()
                    unread_count = data.get("unreadCount", 0)
                    
                    if unread_count == 0:
                        self.log("✅ Unread count is now 0")
                        return True
                    else:
                        self.log(f"❌ Expected unread count 0, got {unread_count}")
                        return False
                else:
                    self.log("❌ Failed to verify unread count")
                    return False
            else:
                self.log(f"❌ Expected modified count 2, got {modified_count}")
                return False
        else:
            self.log(f"❌ Failed to mark all as read: {response.text if response else 'No response'}")
            return False
    
    def test_10_verify_no_self_notification(self):
        """TEST 10: VERIFY NO SELF-NOTIFICATION"""
        self.log("🧪 TEST 10: Verifying no self-notification...")
        
        # User A likes their own post
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        response = self.make_request("POST", f"/posts/{self.post_id}/like", headers=headers)
        
        # This should fail because User B already liked it, but let's check notifications anyway
        self.log(f"📋 Self-like response: {response.status_code}")
        
        # Check User A's notifications - should not have any new ones
        response = self.make_request("GET", "/notifications", headers=headers)
        
        if response and response.status_code == 200:
            notifications = response.json()
            self.log(f"📋 User A has {len(notifications)} notifications")
            
            # All notifications should still be read (from previous test)
            unread_notifications = [n for n in notifications if not n.get("isRead", True)]
            
            if len(unread_notifications) == 0:
                self.log("✅ No new notifications created (no self-notification)")
                return True
            else:
                self.log(f"❌ Found {len(unread_notifications)} unread notifications")
                return False
        else:
            self.log(f"❌ Failed to get notifications: {response.text if response else 'No response'}")
            return False
    
    def test_11_user_a_creates_another_post(self):
        """TEST 11: USER A CREATES ANOTHER POST"""
        self.log("🧪 TEST 11: User A creates another post...")
        
        # Create another test image file
        test_image_content = b"another_fake_image_data_for_testing"
        
        headers = {"Authorization": f"Bearer {self.user_a_token}"}
        data = {
            "rating": "8",
            "review_text": "Delicious pizza! Great atmosphere and friendly staff.",
            "map_link": "https://maps.google.com/?q=Central+Park,New+York"
        }
        files = {
            "file": ("test_image2.jpg", test_image_content, "image/jpeg")
        }
        
        response = self.make_request("POST", "/posts/create", headers=headers, data=data, files=files)
        
        if response and response.status_code == 200:
            result = response.json()
            second_post_id = result.get("post_id")
            self.log(f"✅ Second post created successfully, ID: {second_post_id}")
            
            # Verify User B gets new_post notification
            headers_b = {"Authorization": f"Bearer {self.user_b_token}"}
            response = self.make_request("GET", "/notifications/unread-count", headers=headers_b)
            
            if response and response.status_code == 200:
                data = response.json()
                unread_count = data.get("unreadCount", 0)
                self.log(f"📋 User B unread count: {unread_count}")
                
                if unread_count == 2:  # Should have 2 new_post notifications now
                    self.log("✅ User B has correct unread count (2 new_post notifications)")
                    return True
                else:
                    self.log(f"❌ Expected unread count 2, got {unread_count}")
                    return False
            else:
                self.log(f"❌ Failed to get User B unread count: {response.text if response else 'No response'}")
                return False
        else:
            self.log(f"❌ Second post creation failed: {response.text if response else 'No response'}")
            return False
    
    def run_all_tests(self):
        """Run all notification tests"""
        self.log("🚀 Starting Comprehensive Notifications System Testing")
        self.log(f"📍 Base URL: {self.base_url}")
        
        tests = [
            ("CREATE TEST USERS", self.test_1_create_test_users),
            ("USER B FOLLOWS USER A", self.test_2_user_b_follows_user_a),
            ("GET UNREAD COUNT FOR USER A", self.test_3_get_unread_count_user_a),
            ("USER A CREATES A POST", self.test_4_user_a_creates_post),
            ("USER B LIKES USER A'S POST", self.test_5_user_b_likes_post),
            ("USER B COMMENTS ON USER A'S POST", self.test_6_user_b_comments_on_post),
            ("CHECK USER A'S UNREAD COUNT", self.test_7_check_user_a_unread_count),
            ("MARK SPECIFIC NOTIFICATION AS READ", self.test_8_mark_specific_notification_read),
            ("MARK ALL NOTIFICATIONS AS READ", self.test_9_mark_all_notifications_read),
            ("VERIFY NO SELF-NOTIFICATION", self.test_10_verify_no_self_notification),
            ("USER A CREATES ANOTHER POST", self.test_11_user_a_creates_another_post)
        ]
        
        results = []
        
        for test_name, test_func in tests:
            self.log(f"\n{'='*60}")
            try:
                result = test_func()
                results.append((test_name, result))
                status = "✅ PASS" if result else "❌ FAIL"
                self.log(f"{status}: {test_name}")
            except Exception as e:
                self.log(f"❌ FAIL: {test_name} - Exception: {e}")
                results.append((test_name, False))
        
        # Summary
        self.log(f"\n{'='*60}")
        self.log("📊 TEST SUMMARY")
        self.log(f"{'='*60}")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status} {test_name}")
        
        self.log(f"\n🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Notifications system is working correctly.")
        else:
            self.log(f"⚠️  {total-passed} tests failed. Please review the failures above.")
        
        return passed == total


if __name__ == "__main__":
    test_suite = NotificationsTestSuite()
    success = test_suite.run_all_tests()
    exit(0 if success else 1)