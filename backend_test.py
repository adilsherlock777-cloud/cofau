#!/usr/bin/env python3
"""
Backend Testing for Level & Points System
Tests all endpoints related to the new level and points system implementation.
"""

import requests
import json
import os
import tempfile
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://foodsocial-app.preview.emergentagent.com/api"

class LevelPointsSystemTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
    
    def create_test_image(self):
        """Create a temporary test image file"""
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xdd\x8d\xb4\x1c\x00\x00\x00\x00IEND\xaeB`\x82'
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_file.write(png_data)
        temp_file.close()
        return temp_file.name
    
    def test_signup_default_values(self):
        """Test 1: Verify new users get default level & points values"""
        try:
            # Create unique test user
            timestamp = str(int(datetime.now().timestamp()))
            test_email = f"leveltest_{timestamp}@test.com"
            
            signup_data = {
                "full_name": "Level Test User",
                "email": test_email,
                "password": "testpass123"
            }
            
            response = requests.post(f"{self.base_url}/auth/signup", json=signup_data)
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                
                # Get user profile to verify default values
                headers = {"Authorization": f"Bearer {self.access_token}"}
                me_response = requests.get(f"{self.base_url}/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_data = me_response.json()
                    self.user_id = user_data["id"]
                    
                    # Verify default values
                    expected_defaults = {
                        "level": 1,
                        "currentPoints": 0,
                        "requiredPoints": 1250,
                        "title": "Reviewer"
                    }
                    
                    all_correct = True
                    details = []
                    
                    for key, expected_value in expected_defaults.items():
                        actual_value = user_data.get(key)
                        if actual_value != expected_value:
                            all_correct = False
                            details.append(f"{key}: expected {expected_value}, got {actual_value}")
                        else:
                            details.append(f"{key}: {actual_value} ✓")
                    
                    self.log_test("Signup Default Values", all_correct, "; ".join(details))
                    return all_correct
                else:
                    self.log_test("Signup Default Values", False, f"Failed to get user profile: {me_response.status_code}")
                    return False
            else:
                self.log_test("Signup Default Values", False, f"Signup failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Signup Default Values", False, f"Exception: {str(e)}")
            return False
    
    def test_post_creation_points_award(self):
        """Test 2: Test post creation and verify points are awarded based on level"""
        try:
            if not self.access_token:
                self.log_test("Post Creation Points Award", False, "No access token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            
            # Create test image
            image_path = self.create_test_image()
            
            try:
                # Create post with multipart form data
                with open(image_path, 'rb') as img_file:
                    files = {'file': ('test_image.png', img_file, 'image/png')}
                    data = {
                        'rating': 9,
                        'review_text': 'Amazing coffee shop! Perfect atmosphere for work and great espresso.',
                        'map_link': 'https://maps.google.com/?q=Starbucks+Times+Square'
                    }
                    
                    response = requests.post(f"{self.base_url}/posts/create", 
                                           headers=headers, files=files, data=data)
                
                if response.status_code == 200:
                    post_data = response.json()
                    
                    # Verify response structure and values
                    expected_fields = ["message", "post_id", "leveledUp", "newLevel", "newTitle", 
                                     "pointsEarned", "currentPoints", "requiredPoints"]
                    
                    missing_fields = [field for field in expected_fields if field not in post_data]
                    
                    if missing_fields:
                        self.log_test("Post Creation Points Award", False, 
                                    f"Missing fields in response: {missing_fields}")
                        return False
                    
                    # Verify Level 1 user gets 25 points
                    if post_data["pointsEarned"] != 25:
                        self.log_test("Post Creation Points Award", False, 
                                    f"Expected 25 points for Level 1, got {post_data['pointsEarned']}")
                        return False
                    
                    # Verify level and title
                    if post_data["newLevel"] != 1 or post_data["newTitle"] != "Reviewer":
                        self.log_test("Post Creation Points Award", False, 
                                    f"Unexpected level/title: {post_data['newLevel']}/{post_data['newTitle']}")
                        return False
                    
                    # Verify current points (should be 25 now)
                    if post_data["currentPoints"] != 25:
                        self.log_test("Post Creation Points Award", False, 
                                    f"Expected currentPoints to be 25, got {post_data['currentPoints']}")
                        return False
                    
                    details = f"Points earned: {post_data['pointsEarned']}, Current: {post_data['currentPoints']}, Level: {post_data['newLevel']}"
                    self.log_test("Post Creation Points Award", True, details)
                    return True
                    
                else:
                    self.log_test("Post Creation Points Award", False, 
                                f"Post creation failed: {response.status_code} - {response.text}")
                    return False
                    
            finally:
                # Clean up temp file
                os.unlink(image_path)
                
        except Exception as e:
            self.log_test("Post Creation Points Award", False, f"Exception: {str(e)}")
            return False
    
    def test_level_up_logic(self):
        """Test 3: Test level-up logic with carry-over points"""
        try:
            if not self.access_token or not self.user_id:
                self.log_test("Level-Up Logic", False, "No access token or user ID available")
                return False
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            
            # First, manually update user to have 1240 points (close to level-up at 1250)
            # We'll do this by creating multiple posts to get close to level-up
            
            # Get current user state
            me_response = requests.get(f"{self.base_url}/auth/me", headers=headers)
            if me_response.status_code != 200:
                self.log_test("Level-Up Logic", False, "Failed to get current user state")
                return False
            
            current_user = me_response.json()
            current_points = current_user.get("currentPoints", 0)
            
            # Calculate how many more posts we need to get close to level-up
            # We want to get to 1240 points (10 points away from 1250)
            target_points = 1240
            points_needed = target_points - current_points
            posts_needed = max(0, points_needed // 25)  # Each post gives 25 points at level 1
            
            print(f"   Current points: {current_points}, need {points_needed} more points")
            print(f"   Creating {posts_needed} posts to reach {target_points} points")
            
            # Create posts to get close to level-up
            for i in range(posts_needed):
                image_path = self.create_test_image()
                try:
                    with open(image_path, 'rb') as img_file:
                        files = {'file': (f'test_image_{i}.png', img_file, 'image/png')}
                        data = {
                            'rating': 8,
                            'review_text': f'Test review {i+1} for level-up testing',
                            'map_link': 'https://maps.google.com/?q=Test+Location'
                        }
                        
                        response = requests.post(f"{self.base_url}/posts/create", 
                                               headers=headers, files=files, data=data)
                        
                        if response.status_code != 200:
                            self.log_test("Level-Up Logic", False, 
                                        f"Failed to create setup post {i+1}: {response.status_code}")
                            return False
                finally:
                    os.unlink(image_path)
            
            # Now create one more post to trigger level-up
            image_path = self.create_test_image()
            try:
                with open(image_path, 'rb') as img_file:
                    files = {'file': ('levelup_test.png', img_file, 'image/png')}
                    data = {
                        'rating': 10,
                        'review_text': 'This post should trigger level-up with carry-over points!',
                        'map_link': 'https://maps.google.com/?q=Level+Up+Location'
                    }
                    
                    response = requests.post(f"{self.base_url}/posts/create", 
                                           headers=headers, files=files, data=data)
                
                if response.status_code == 200:
                    post_data = response.json()
                    
                    # Check if level-up occurred
                    if not post_data.get("leveledUp", False):
                        # Maybe we didn't have enough points, let's check current state
                        me_response = requests.get(f"{self.base_url}/auth/me", headers=headers)
                        if me_response.status_code == 200:
                            user_data = me_response.json()
                            details = f"No level-up occurred. Current: {user_data.get('currentPoints')}/{user_data.get('requiredPoints')} points, Level: {user_data.get('level')}"
                            self.log_test("Level-Up Logic", False, details)
                        else:
                            self.log_test("Level-Up Logic", False, "No level-up occurred and couldn't get user state")
                        return False
                    
                    # Verify level-up details
                    expected_new_level = 2
                    expected_title = "Reviewer"
                    expected_required_points = 2500
                    
                    success = True
                    details = []
                    
                    if post_data["newLevel"] != expected_new_level:
                        success = False
                        details.append(f"Expected level {expected_new_level}, got {post_data['newLevel']}")
                    
                    if post_data["newTitle"] != expected_title:
                        success = False
                        details.append(f"Expected title '{expected_title}', got '{post_data['newTitle']}'")
                    
                    if post_data["requiredPoints"] != expected_required_points:
                        success = False
                        details.append(f"Expected requiredPoints {expected_required_points}, got {post_data['requiredPoints']}")
                    
                    # Verify carry-over points (should be less than required points for level 2)
                    if post_data["currentPoints"] >= post_data["requiredPoints"]:
                        success = False
                        details.append(f"Carry-over points issue: {post_data['currentPoints']} >= {post_data['requiredPoints']}")
                    
                    if success:
                        details.append(f"Level-up successful: Level {post_data['newLevel']}, Points: {post_data['currentPoints']}/{post_data['requiredPoints']}")
                    
                    self.log_test("Level-Up Logic", success, "; ".join(details))
                    return success
                    
                else:
                    self.log_test("Level-Up Logic", False, 
                                f"Level-up post creation failed: {response.status_code} - {response.text}")
                    return False
                    
            finally:
                os.unlink(image_path)
                
        except Exception as e:
            self.log_test("Level-Up Logic", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_me_endpoint(self):
        """Test 4: Verify /api/auth/me returns all new level fields"""
        try:
            if not self.access_token:
                self.log_test("Auth Me Endpoint", False, "No access token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                
                # Check for all required level fields
                required_fields = ["level", "currentPoints", "requiredPoints", "title"]
                missing_fields = [field for field in required_fields if field not in user_data]
                
                if missing_fields:
                    self.log_test("Auth Me Endpoint", False, f"Missing fields: {missing_fields}")
                    return False
                
                # Verify field types and reasonable values
                success = True
                details = []
                
                if not isinstance(user_data["level"], int) or user_data["level"] < 1:
                    success = False
                    details.append(f"Invalid level: {user_data['level']}")
                
                if not isinstance(user_data["currentPoints"], int) or user_data["currentPoints"] < 0:
                    success = False
                    details.append(f"Invalid currentPoints: {user_data['currentPoints']}")
                
                if not isinstance(user_data["requiredPoints"], int) or user_data["requiredPoints"] <= 0:
                    success = False
                    details.append(f"Invalid requiredPoints: {user_data['requiredPoints']}")
                
                if not isinstance(user_data["title"], str) or user_data["title"] not in ["Reviewer", "Top Reviewer", "Influencer"]:
                    success = False
                    details.append(f"Invalid title: {user_data['title']}")
                
                if success:
                    details.append(f"All fields present: Level {user_data['level']}, Points {user_data['currentPoints']}/{user_data['requiredPoints']}, Title: {user_data['title']}")
                
                self.log_test("Auth Me Endpoint", success, "; ".join(details))
                return success
                
            else:
                self.log_test("Auth Me Endpoint", False, f"Request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Auth Me Endpoint", False, f"Exception: {str(e)}")
            return False
    
    def test_feed_endpoint_level_fields(self):
        """Test 5: Verify feed endpoint includes user_level and user_title"""
        try:
            if not self.access_token:
                self.log_test("Feed Endpoint Level Fields", False, "No access token available")
                return False
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{self.base_url}/feed", headers=headers)
            
            if response.status_code == 200:
                feed_data = response.json()
                
                if not isinstance(feed_data, list):
                    self.log_test("Feed Endpoint Level Fields", False, "Feed response is not a list")
                    return False
                
                if len(feed_data) == 0:
                    self.log_test("Feed Endpoint Level Fields", False, "Feed is empty - no posts to verify")
                    return False
                
                # Check first post for level fields
                first_post = feed_data[0]
                required_fields = ["user_level", "user_title"]
                missing_fields = [field for field in required_fields if field not in first_post]
                
                if missing_fields:
                    self.log_test("Feed Endpoint Level Fields", False, f"Missing fields in feed post: {missing_fields}")
                    return False
                
                # Verify field values
                success = True
                details = []
                
                if not isinstance(first_post["user_level"], int) or first_post["user_level"] < 1:
                    success = False
                    details.append(f"Invalid user_level: {first_post['user_level']}")
                
                if not isinstance(first_post["user_title"], str) or first_post["user_title"] not in ["Reviewer", "Top Reviewer", "Influencer"]:
                    success = False
                    details.append(f"Invalid user_title: {first_post['user_title']}")
                
                if success:
                    details.append(f"Feed includes level fields: user_level={first_post['user_level']}, user_title='{first_post['user_title']}'")
                    details.append(f"Total posts in feed: {len(feed_data)}")
                
                self.log_test("Feed Endpoint Level Fields", success, "; ".join(details))
                return success
                
            else:
                self.log_test("Feed Endpoint Level Fields", False, f"Feed request failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Feed Endpoint Level Fields", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all level & points system tests"""
        print("🚀 Starting Level & Points System Backend Tests")
        print("=" * 60)
        
        # Run tests in sequence
        tests = [
            self.test_signup_default_values,
            self.test_post_creation_points_award,
            self.test_level_up_logic,
            self.test_auth_me_endpoint,
            self.test_feed_endpoint_level_fields
        ]
        
        for test in tests:
            test()
            print()  # Add spacing between tests
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed == total

if __name__ == "__main__":
    tester = LevelPointsSystemTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Level & Points System is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the details above.")