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
BASE_URL = "https://foodsocial-app.preview.emergentagent.com/api"

class NotificationsTestSuite:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        self.user1_token = None
        self.user2_token = None
        self.user1_id = None
        self.user2_id = None
        self.post_id = None
        
    def log_test(self, test_name, success, details, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def test_1_create_new_user_account(self):
        """TEST 1: CREATE NEW USER ACCOUNT"""
        print("=" * 60)
        print("TEST 1: CREATE NEW USER ACCOUNT")
        print("=" * 60)
        
        # Generate unique email with timestamp
        timestamp = int(time.time())
        email = f"test_dp_user_{timestamp}@test.com"
        
        payload = {
            "full_name": "Test DP User",
            "email": email,
            "password": "TestPass123!"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/signup", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields
                if "access_token" in data:
                    self.user1_token = data["access_token"]
                    
                    # Now get user profile to verify level and points
                    headers = {"Authorization": f"Bearer {self.user1_token}"}
                    profile_response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
                    
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        self.user1_id = profile_data.get("id")
                        
                        # Verify default values
                        level = profile_data.get("level")
                        current_points = profile_data.get("currentPoints")
                        required_points = profile_data.get("requiredPoints")
                        profile_picture = profile_data.get("profile_picture")
                        
                        if (level == 1 and current_points == 0 and 
                            required_points == 1250 and profile_picture is None):
                            self.log_test(
                                "User Signup", 
                                True, 
                                f"User created successfully with email {email}. Default values: level=1, currentPoints=0, requiredPoints=1250, profile_picture=null",
                                {"signup": data, "profile": profile_data}
                            )
                        else:
                            self.log_test(
                                "User Signup", 
                                False, 
                                f"Default values incorrect. Got: level={level}, currentPoints={current_points}, requiredPoints={required_points}, profile_picture={profile_picture}",
                                profile_data
                            )
                    else:
                        self.log_test("User Signup", False, f"Failed to get user profile: {profile_response.status_code}", profile_response.text)
                else:
                    self.log_test("User Signup", False, "No access_token in response", data)
            else:
                self.log_test("User Signup", False, f"Signup failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("User Signup", False, f"Exception during signup: {str(e)}")

    def test_2_upload_new_post(self):
        """TEST 2: UPLOAD A NEW POST"""
        print("=" * 60)
        print("TEST 2: UPLOAD A NEW POST")
        print("=" * 60)
        
        if not self.user1_token:
            self.log_test("Post Upload", False, "No user token available from previous test")
            return
            
        # Create a simple test image file
        test_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('test_image.png', test_image_content, 'image/png')
        }
        
        data = {
            'rating': '8',
            'review_text': 'Testing profile picture system - this is a great restaurant!',
            'map_link': 'https://maps.google.com/?q=New+York'
        }
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.post(f"{BASE_URL}/posts/create", files=files, data=data, headers=headers)
            
            if response.status_code == 200:
                response_data = response.json()
                
                # Check required fields
                post_id = response_data.get("post_id")
                points_earned = response_data.get("pointsEarned")
                current_points = response_data.get("currentPoints")
                required_points = response_data.get("requiredPoints")
                level = response_data.get("newLevel")
                leveled_up = response_data.get("leveledUp")
                
                if (post_id and points_earned == 25 and current_points == 25 and 
                    required_points == 1250 and level == 1 and leveled_up == False):
                    self.post_id = post_id
                    self.log_test(
                        "Post Upload", 
                        True, 
                        f"Post created successfully. ID: {post_id}, pointsEarned: 25, currentPoints: 25, requiredPoints: 1250, level: 1, leveledUp: false",
                        response_data
                    )
                else:
                    self.log_test(
                        "Post Upload", 
                        False, 
                        f"Response values incorrect. Got: post_id={post_id}, pointsEarned={points_earned}, currentPoints={current_points}, requiredPoints={required_points}, level={level}, leveledUp={leveled_up}",
                        response_data
                    )
            else:
                self.log_test("Post Upload", False, f"Post creation failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Post Upload", False, f"Exception during post upload: {str(e)}")

    def test_3_verify_points_in_auth_me(self):
        """TEST 3: VERIFY POINTS IN AUTH/ME"""
        print("=" * 60)
        print("TEST 3: VERIFY POINTS IN AUTH/ME")
        print("=" * 60)
        
        if not self.user1_token:
            self.log_test("Auth Me Points", False, "No user token available")
            return
            
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                level = data.get("level")
                current_points = data.get("currentPoints")
                required_points = data.get("requiredPoints")
                
                if level == 1 and current_points == 25 and required_points == 1250:
                    self.log_test(
                        "Auth Me Points", 
                        True, 
                        f"Points verified correctly: level=1, currentPoints=25, requiredPoints=1250",
                        data
                    )
                else:
                    self.log_test(
                        "Auth Me Points", 
                        False, 
                        f"Points incorrect. Got: level={level}, currentPoints={current_points}, requiredPoints={required_points}",
                        data
                    )
            else:
                self.log_test("Auth Me Points", False, f"Auth me failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Auth Me Points", False, f"Exception during auth me: {str(e)}")

    def test_4_verify_post_in_feed(self):
        """TEST 4: VERIFY POST IN FEED"""
        print("=" * 60)
        print("TEST 4: VERIFY POST IN FEED")
        print("=" * 60)
        
        if not self.user1_token or not self.post_id:
            self.log_test("Feed Verification", False, "No user token or post ID available")
            return
            
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/feed", headers=headers)
            
            if response.status_code == 200:
                feed_data = response.json()
                
                # Find the newly created post
                post_found = None
                for post in feed_data:
                    if post.get("id") == self.post_id:
                        post_found = post
                        break
                
                if post_found:
                    # Verify post details
                    user_profile_picture = post_found.get("user_profile_picture")
                    review_text = post_found.get("review_text")
                    rating = post_found.get("rating")
                    user_level = post_found.get("user_level")
                    user_title = post_found.get("user_title")
                    
                    if (user_profile_picture is None and 
                        review_text == "Testing profile picture system - this is a great restaurant!" and
                        rating == 8 and user_level == 1 and user_title == "Reviewer"):
                        self.log_test(
                            "Feed Verification", 
                            True, 
                            f"Post found in feed with correct details: user_profile_picture=null, rating=8, user_level=1, user_title='Reviewer'",
                            post_found
                        )
                    else:
                        self.log_test(
                            "Feed Verification", 
                            False, 
                            f"Post details incorrect. Got: user_profile_picture={user_profile_picture}, review_text='{review_text}', rating={rating}, user_level={user_level}, user_title='{user_title}'",
                            post_found
                        )
                else:
                    self.log_test("Feed Verification", False, f"Post with ID {self.post_id} not found in feed", feed_data)
            else:
                self.log_test("Feed Verification", False, f"Feed request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Feed Verification", False, f"Exception during feed verification: {str(e)}")

    def test_5_upload_profile_picture(self):
        """TEST 5: UPLOAD PROFILE PICTURE"""
        print("=" * 60)
        print("TEST 5: UPLOAD PROFILE PICTURE")
        print("=" * 60)
        
        if not self.user1_token:
            self.log_test("Profile Picture Upload", False, "No user token available")
            return
            
        # Create a simple test image file
        test_image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {
            'file': ('profile_pic.png', test_image_content, 'image/png')
        }
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.post(f"{BASE_URL}/users/upload-profile-image", files=files, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                profile_picture_url = data.get("profile_image_url")
                
                if profile_picture_url and profile_picture_url.startswith("/api/static/uploads/"):
                    self.log_test(
                        "Profile Picture Upload", 
                        True, 
                        f"Profile picture uploaded successfully. URL: {profile_picture_url}",
                        data
                    )
                else:
                    self.log_test(
                        "Profile Picture Upload", 
                        False, 
                        f"Invalid profile picture URL: {profile_picture_url}",
                        data
                    )
            else:
                self.log_test("Profile Picture Upload", False, f"Profile picture upload failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Profile Picture Upload", False, f"Exception during profile picture upload: {str(e)}")

    def test_6_verify_profile_picture_in_auth_me(self):
        """TEST 6: VERIFY PROFILE PICTURE IN AUTH/ME"""
        print("=" * 60)
        print("TEST 6: VERIFY PROFILE PICTURE IN AUTH/ME")
        print("=" * 60)
        
        if not self.user1_token:
            self.log_test("Auth Me Profile Picture", False, "No user token available")
            return
            
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                profile_picture = data.get("profile_picture")
                
                if profile_picture and profile_picture.startswith("/api/static/uploads/"):
                    self.log_test(
                        "Auth Me Profile Picture", 
                        True, 
                        f"Profile picture URL verified in auth/me: {profile_picture}",
                        data
                    )
                else:
                    self.log_test(
                        "Auth Me Profile Picture", 
                        False, 
                        f"Profile picture URL not found or invalid: {profile_picture}",
                        data
                    )
            else:
                self.log_test("Auth Me Profile Picture", False, f"Auth me failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Auth Me Profile Picture", False, f"Exception during auth me profile picture check: {str(e)}")

    def test_7_verify_dp_in_feed(self):
        """TEST 7: VERIFY DP IN FEED"""
        print("=" * 60)
        print("TEST 7: VERIFY DP IN FEED")
        print("=" * 60)
        
        if not self.user1_token or not self.post_id:
            self.log_test("Feed DP Verification", False, "No user token or post ID available")
            return
            
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/feed", headers=headers)
            
            if response.status_code == 200:
                feed_data = response.json()
                
                # Find the user's post
                post_found = None
                for post in feed_data:
                    if post.get("id") == self.post_id:
                        post_found = post
                        break
                
                if post_found:
                    user_profile_picture = post_found.get("user_profile_picture")
                    
                    if user_profile_picture and user_profile_picture.startswith("/api/static/uploads/"):
                        self.log_test(
                            "Feed DP Verification", 
                            True, 
                            f"Profile picture now visible in feed: {user_profile_picture}",
                            post_found
                        )
                    else:
                        self.log_test(
                            "Feed DP Verification", 
                            False, 
                            f"Profile picture not found or invalid in feed: {user_profile_picture}",
                            post_found
                        )
                else:
                    self.log_test("Feed DP Verification", False, f"Post with ID {self.post_id} not found in feed", feed_data)
            else:
                self.log_test("Feed DP Verification", False, f"Feed request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Feed DP Verification", False, f"Exception during feed DP verification: {str(e)}")

    def test_8_create_second_user(self):
        """TEST 8: CREATE SECOND USER FOR FOLLOW TEST"""
        print("=" * 60)
        print("TEST 8: CREATE SECOND USER FOR FOLLOW TEST")
        print("=" * 60)
        
        # Generate unique email with timestamp
        timestamp = int(time.time())
        email = f"second_user_{timestamp}@test.com"
        
        payload = {
            "full_name": "Second User",
            "email": email,
            "password": "TestPass123!"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/signup", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                if "access_token" in data:
                    self.user2_token = data["access_token"]
                    
                    # Get user profile to get user ID
                    headers = {"Authorization": f"Bearer {self.user2_token}"}
                    profile_response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
                    
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        self.user2_id = profile_data.get("id")
                        
                        self.log_test(
                            "Second User Creation", 
                            True, 
                            f"Second user created successfully with email {email}",
                            {"signup": data, "profile": profile_data}
                        )
                    else:
                        self.log_test("Second User Creation", False, f"Failed to get second user profile: {profile_response.status_code}", profile_response.text)
                else:
                    self.log_test("Second User Creation", False, "No access_token in response", data)
            else:
                self.log_test("Second User Creation", False, f"Second user signup failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Second User Creation", False, f"Exception during second user signup: {str(e)}")

    def test_9_follow_first_user(self):
        """TEST 9: FOLLOW FIRST USER"""
        print("=" * 60)
        print("TEST 9: FOLLOW FIRST USER")
        print("=" * 60)
        
        if not self.user2_token or not self.user1_id:
            self.log_test("Follow User", False, "No second user token or first user ID available")
            return
            
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        
        try:
            response = self.session.post(f"{BASE_URL}/users/{self.user1_id}/follow", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if "message" in data and ("followed" in data["message"].lower() or "following" in data["message"].lower()):
                    self.log_test(
                        "Follow User", 
                        True, 
                        f"Successfully followed user {self.user1_id}",
                        data
                    )
                else:
                    self.log_test("Follow User", False, f"Unexpected response format", data)
            else:
                self.log_test("Follow User", False, f"Follow request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Follow User", False, f"Exception during follow: {str(e)}")

    def test_10_verify_follow_status(self):
        """TEST 10: VERIFY FOLLOW STATUS"""
        print("=" * 60)
        print("TEST 10: VERIFY FOLLOW STATUS")
        print("=" * 60)
        
        if not self.user2_token or not self.user1_id:
            self.log_test("Follow Status", False, "No second user token or first user ID available")
            return
            
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/users/{self.user1_id}/follow-status", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                is_following = data.get("isFollowing")
                
                if is_following == True:
                    self.log_test(
                        "Follow Status", 
                        True, 
                        f"Follow status verified: isFollowing=true",
                        data
                    )
                else:
                    self.log_test("Follow Status", False, f"Follow status incorrect: isFollowing={is_following}", data)
            else:
                self.log_test("Follow Status", False, f"Follow status request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Follow Status", False, f"Exception during follow status check: {str(e)}")

    def test_11_verify_follower_count(self):
        """TEST 11: VERIFY FOLLOWER COUNT"""
        print("=" * 60)
        print("TEST 11: VERIFY FOLLOWER COUNT")
        print("=" * 60)
        
        if not self.user1_id:
            self.log_test("Follower Count", False, "No first user ID available")
            return
            
        try:
            response = self.session.get(f"{BASE_URL}/users/{self.user1_id}/stats")
            
            if response.status_code == 200:
                data = response.json()
                
                followers_count = data.get("followers_count")
                
                if followers_count >= 1:
                    self.log_test(
                        "Follower Count", 
                        True, 
                        f"Follower count verified: {followers_count} (should be >= 1)",
                        data
                    )
                else:
                    self.log_test("Follower Count", False, f"Follower count incorrect: {followers_count}", data)
            else:
                self.log_test("Follower Count", False, f"User stats request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Follower Count", False, f"Exception during follower count check: {str(e)}")

    def test_12_like_and_comment_on_post(self):
        """TEST 12: LIKE AND COMMENT ON POST"""
        print("=" * 60)
        print("TEST 12: LIKE AND COMMENT ON POST")
        print("=" * 60)
        
        if not self.user2_token or not self.post_id:
            self.log_test("Like and Comment", False, "No second user token or post ID available")
            return
            
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        
        # Test like
        try:
            like_response = self.session.post(f"{BASE_URL}/posts/{self.post_id}/like", headers=headers)
            
            like_success = False
            if like_response.status_code == 200:
                like_data = like_response.json()
                if "message" in like_data and "liked" in like_data["message"].lower():
                    like_success = True
            
            # Test comment
            comment_data = {
                'comment_text': 'Great post!'
            }
            
            comment_response = self.session.post(f"{BASE_URL}/posts/{self.post_id}/comment", data=comment_data, headers=headers)
            
            comment_success = False
            comment_id = None
            if comment_response.status_code == 200:
                comment_response_data = comment_response.json()
                comment_id = comment_response_data.get("comment_id")
                if comment_id:
                    comment_success = True
            
            if like_success and comment_success:
                self.log_test(
                    "Like and Comment", 
                    True, 
                    f"Successfully liked post and added comment. Comment ID: {comment_id}",
                    {"like": like_data, "comment": comment_response_data}
                )
            else:
                self.log_test(
                    "Like and Comment", 
                    False, 
                    f"Like success: {like_success}, Comment success: {comment_success}",
                    {"like_response": like_response.text, "comment_response": comment_response.text}
                )
                
        except Exception as e:
            self.log_test("Like and Comment", False, f"Exception during like and comment: {str(e)}")

    def test_13_verify_comments(self):
        """TEST 13: VERIFY COMMENTS"""
        print("=" * 60)
        print("TEST 13: VERIFY COMMENTS")
        print("=" * 60)
        
        if not self.post_id:
            self.log_test("Comments Verification", False, "No post ID available")
            return
            
        try:
            response = self.session.get(f"{BASE_URL}/posts/{self.post_id}/comments")
            
            if response.status_code == 200:
                comments_data = response.json()
                
                # Find the comment from Second User
                comment_found = None
                for comment in comments_data:
                    if (comment.get("username") == "Second User" and 
                        comment.get("comment_text") == "Great post!"):
                        comment_found = comment
                        break
                
                if comment_found:
                    profile_pic = comment_found.get("profile_pic")
                    
                    # Profile pic should be null for second user (no DP uploaded)
                    if profile_pic is None:
                        self.log_test(
                            "Comments Verification", 
                            True, 
                            f"Comment found with correct details: username='Second User', comment_text='Great post!', profile_pic=null",
                            comment_found
                        )
                    else:
                        self.log_test(
                            "Comments Verification", 
                            False, 
                            f"Comment profile_pic should be null but got: {profile_pic}",
                            comment_found
                        )
                else:
                    self.log_test("Comments Verification", False, "Comment from 'Second User' with text 'Great post!' not found", comments_data)
            else:
                self.log_test("Comments Verification", False, f"Comments request failed with status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_test("Comments Verification", False, f"Exception during comments verification: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive End-to-End Backend Testing")
        print(f"🌐 Base URL: {BASE_URL}")
        print()
        
        # Run tests in sequence
        self.test_1_create_new_user_account()
        self.test_2_upload_new_post()
        self.test_3_verify_points_in_auth_me()
        self.test_4_verify_post_in_feed()
        self.test_5_upload_profile_picture()
        self.test_6_verify_profile_picture_in_auth_me()
        self.test_7_verify_dp_in_feed()
        self.test_8_create_second_user()
        self.test_9_follow_first_user()
        self.test_10_verify_follow_status()
        self.test_11_verify_follower_count()
        self.test_12_like_and_comment_on_post()
        self.test_13_verify_comments()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 80)
        print("🏁 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # List failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['details']}")
        else:
            print("✅ ALL TESTS PASSED!")
        
        print()
        print("=" * 80)

if __name__ == "__main__":
    tester = CofauTester()
    tester.run_all_tests()
