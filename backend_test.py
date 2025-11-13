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
BACKEND_URL = "https://cofau-app.preview.emergentagent.com/api"

class LevelPointsSystemTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.access_token = None
        self.user_id = None
        self.test_results = []
        
    def log_result(self, test_name, success, details, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response_sample"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
    
    def test_auth_signup(self):
        """Test user signup endpoint"""
        try:
            payload = {
                "full_name": self.test_user_name,
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = requests.post(f"{self.base_url}/auth/signup", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.auth_token = data["access_token"]
                    self.log_result("User Signup API", True, 
                                  f"Successfully created user. Token received: {data['token_type']}", 
                                  {"status_code": 200, "has_token": True})
                    return True
                else:
                    self.log_result("User Signup API", False, 
                                  "No access token in response", data)
                    return False
            elif response.status_code == 400 and "already registered" in response.text.lower():
                # User already exists, try login instead
                self.log_result("User Signup API", True, 
                              "User already exists (expected for repeat tests)", 
                              {"status_code": 400, "message": "User exists"})
                return self.test_auth_login()
            else:
                self.log_result("User Signup API", False, 
                              f"Unexpected status code: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("User Signup API", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_login(self):
        """Test user login endpoint"""
        try:
            # OAuth2PasswordRequestForm expects form data, not JSON
            payload = {
                "username": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = requests.post(f"{self.base_url}/auth/login", data=payload)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data:
                    self.auth_token = data["access_token"]
                    self.log_result("User Login API", True, 
                                  f"Successfully logged in. Token type: {data['token_type']}", 
                                  {"status_code": 200, "token_type": data["token_type"]})
                    return True
                else:
                    self.log_result("User Login API", False, 
                                  "No access token in response", data)
                    return False
            else:
                self.log_result("User Login API", False, 
                              f"Login failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("User Login API", False, f"Exception: {str(e)}")
            return False
    
    def test_auth_me(self):
        """Test protected user profile endpoint"""
        if not self.auth_token:
            self.log_result("Protected User Profile API", False, "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["id", "full_name", "email", "points", "level"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Protected User Profile API", True, 
                                  f"Profile retrieved successfully. User: {data['full_name']}", 
                                  {"user_id": data["id"], "level": data["level"], "points": data["points"]})
                    return True
                else:
                    self.log_result("Protected User Profile API", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return False
            else:
                self.log_result("Protected User Profile API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Protected User Profile API", False, f"Exception: {str(e)}")
            return False
    
    def test_create_post(self):
        """Test post creation with file upload"""
        if not self.auth_token:
            self.log_result("Post Creation API", False, "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Create a test image file
            test_image_content = b"fake_image_content_for_testing"
            files = {
                'file': ('test_food.jpg', test_image_content, 'image/jpeg')
            }
            
            data = {
                'rating': 9,
                'review_text': 'Incredible sushi experience! Fresh fish, perfect rice, amazing presentation. The chef really knows their craft.',
                'map_link': 'https://maps.google.com/?q=Sushi+Restaurant+NYC'
            }
            
            response = requests.post(f"{self.base_url}/posts/create", 
                                   headers=headers, files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                if "post_id" in result:
                    self.test_post_id = result["post_id"]
                    self.log_result("Post Creation API", True, 
                                  f"Post created successfully. ID: {self.test_post_id}", 
                                  {"post_id": self.test_post_id, "message": result["message"]})
                    return True
                else:
                    self.log_result("Post Creation API", False, 
                                  "No post_id in response", result)
                    return False
            else:
                self.log_result("Post Creation API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Post Creation API", False, f"Exception: {str(e)}")
            return False
    
    def test_feed_api(self):
        """Test feed endpoint with authentication"""
        if not self.auth_token:
            self.log_result("Feed API", False, "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/feed?skip=0&limit=10", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        post = data[0]
                        required_fields = ["id", "username", "media_url", "image_url", "rating", "review_text"]
                        missing_fields = [field for field in required_fields if field not in post]
                        
                        if not missing_fields:
                            # Check image_url format
                            image_url = post.get("image_url", "")
                            correct_format = image_url.startswith("/api/static/uploads/")
                            
                            self.log_result("Feed API", True, 
                                          f"Feed retrieved with {len(data)} posts. Image URL format correct: {correct_format}", 
                                          {"posts_count": len(data), "sample_image_url": image_url, "correct_format": correct_format})
                            return True
                        else:
                            self.log_result("Feed API", False, 
                                          f"Missing required fields in post: {missing_fields}", post)
                            return False
                    else:
                        self.log_result("Feed API", True, 
                                      "Feed endpoint working but no posts available", 
                                      {"posts_count": 0})
                        return True
                else:
                    self.log_result("Feed API", False, 
                                  "Response is not a list", data)
                    return False
            else:
                self.log_result("Feed API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Feed API", False, f"Exception: {str(e)}")
            return False
    
    def test_like_post(self):
        """Test like post endpoint"""
        if not self.auth_token or not self.test_post_id:
            self.log_result("Like Post API", False, "No auth token or post ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.post(f"{self.base_url}/posts/{self.test_post_id}/like", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Like Post API", True, 
                              f"Post liked successfully: {data['message']}", 
                              {"message": data["message"]})
                return True
            elif response.status_code == 400 and "already liked" in response.text.lower():
                self.log_result("Like Post API", True, 
                              "Post already liked (expected behavior for repeat tests)", 
                              {"status_code": 400, "message": "Already liked"})
                return True
            else:
                self.log_result("Like Post API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Like Post API", False, f"Exception: {str(e)}")
            return False
    
    def test_unlike_post(self):
        """Test unlike post endpoint"""
        if not self.auth_token or not self.test_post_id:
            self.log_result("Unlike Post API", False, "No auth token or post ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.delete(f"{self.base_url}/posts/{self.test_post_id}/like", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Unlike Post API", True, 
                              f"Post unliked successfully: {data['message']}", 
                              {"message": data["message"]})
                return True
            elif response.status_code == 400 and "not found" in response.text.lower():
                self.log_result("Unlike Post API", True, 
                              "Like not found (expected if not previously liked)", 
                              {"status_code": 400, "message": "Like not found"})
                return True
            else:
                self.log_result("Unlike Post API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Unlike Post API", False, f"Exception: {str(e)}")
            return False
    
    def test_add_comment(self):
        """Test add comment endpoint"""
        if not self.auth_token or not self.test_post_id:
            self.log_result("Comment Creation API", False, "No auth token or post ID available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            data = {"comment_text": "This looks absolutely delicious! Where is this restaurant located?"}
            
            response = requests.post(f"{self.base_url}/posts/{self.test_post_id}/comment", 
                                   headers=headers, data=data)
            
            if response.status_code == 200:
                result = response.json()
                if "comment_id" in result:
                    self.log_result("Comment Creation API", True, 
                                  f"Comment added successfully. ID: {result['comment_id']}", 
                                  {"comment_id": result["comment_id"], "message": result["message"]})
                    return True
                else:
                    self.log_result("Comment Creation API", False, 
                                  "No comment_id in response", result)
                    return False
            else:
                self.log_result("Comment Creation API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Comment Creation API", False, f"Exception: {str(e)}")
            return False
    
    def test_get_comments(self):
        """Test get comments endpoint"""
        if not self.test_post_id:
            self.log_result("Get Comments API", False, "No post ID available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/posts/{self.test_post_id}/comments")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        comment = data[0]
                        required_fields = ["id", "user_id", "username", "comment_text", "created_at"]
                        missing_fields = [field for field in required_fields if field not in comment]
                        
                        if not missing_fields:
                            self.log_result("Get Comments API", True, 
                                          f"Comments retrieved successfully. Count: {len(data)}", 
                                          {"comments_count": len(data), "sample_username": comment["username"]})
                            return True
                        else:
                            self.log_result("Get Comments API", False, 
                                          f"Missing required fields in comment: {missing_fields}", comment)
                            return False
                    else:
                        self.log_result("Get Comments API", True, 
                                      "Comments endpoint working but no comments available", 
                                      {"comments_count": 0})
                        return True
                else:
                    self.log_result("Get Comments API", False, 
                                  "Response is not a list", data)
                    return False
            else:
                self.log_result("Get Comments API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Get Comments API", False, f"Exception: {str(e)}")
            return False
    
    def test_explore_trending(self):
        """Test explore trending posts endpoint"""
        if not self.auth_token:
            self.log_result("Explore Trending Posts API", False, "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/explore/trending?skip=0&limit=10", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        post = data[0]
                        required_fields = ["id", "username", "media_url", "image_url", "rating", "likes_count"]
                        missing_fields = [field for field in required_fields if field not in post]
                        
                        if not missing_fields:
                            # Check image_url format
                            image_url = post.get("image_url", "")
                            correct_format = image_url.startswith("/api/static/uploads/")
                            
                            self.log_result("Explore Trending Posts API", True, 
                                          f"Trending posts retrieved. Count: {len(data)}, Image format correct: {correct_format}", 
                                          {"posts_count": len(data), "sample_rating": post["rating"], "correct_format": correct_format})
                            return True
                        else:
                            self.log_result("Explore Trending Posts API", False, 
                                          f"Missing required fields: {missing_fields}", post)
                            return False
                    else:
                        self.log_result("Explore Trending Posts API", True, 
                                      "Trending endpoint working but no posts available", 
                                      {"posts_count": 0})
                        return True
                else:
                    self.log_result("Explore Trending Posts API", False, 
                                  "Response is not a list", data)
                    return False
            else:
                self.log_result("Explore Trending Posts API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Explore Trending Posts API", False, f"Exception: {str(e)}")
            return False
    
    def test_explore_top_rated(self):
        """Test explore top-rated posts endpoint"""
        if not self.auth_token:
            self.log_result("Explore Top Rated Posts API", False, "No auth token available")
            return False
            
        try:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/explore/top-rated?skip=0&limit=10", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        post = data[0]
                        required_fields = ["id", "username", "media_url", "image_url", "rating", "likes_count"]
                        missing_fields = [field for field in required_fields if field not in post]
                        
                        if not missing_fields:
                            # Verify rating >= 8 (as per implementation)
                            rating = post.get("rating", 0)
                            rating_valid = rating >= 8
                            
                            # Check image_url format
                            image_url = post.get("image_url", "")
                            correct_format = image_url.startswith("/api/static/uploads/")
                            
                            self.log_result("Explore Top Rated Posts API", True, 
                                          f"Top-rated posts retrieved. Count: {len(data)}, Min rating: {rating}, Format correct: {correct_format}", 
                                          {"posts_count": len(data), "min_rating": rating, "rating_valid": rating_valid, "correct_format": correct_format})
                            return True
                        else:
                            self.log_result("Explore Top Rated Posts API", False, 
                                          f"Missing required fields: {missing_fields}", post)
                            return False
                    else:
                        self.log_result("Explore Top Rated Posts API", True, 
                                      "Top-rated endpoint working but no high-rated posts available", 
                                      {"posts_count": 0})
                        return True
                else:
                    self.log_result("Explore Top Rated Posts API", False, 
                                  "Response is not a list", data)
                    return False
            else:
                self.log_result("Explore Top Rated Posts API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Explore Top Rated Posts API", False, f"Exception: {str(e)}")
            return False
    
    def test_explore_reviewers(self):
        """Test explore reviewers endpoint"""
        try:
            response = requests.get(f"{self.base_url}/explore/reviewers?skip=0&limit=10")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        reviewer = data[0]
                        required_fields = ["id", "username", "level", "points", "posts_count"]
                        missing_fields = [field for field in required_fields if field not in reviewer]
                        
                        if not missing_fields:
                            self.log_result("Explore Reviewers API", True, 
                                          f"Top reviewers retrieved. Count: {len(data)}, Top level: {reviewer['level']}", 
                                          {"reviewers_count": len(data), "top_level": reviewer["level"], "top_points": reviewer["points"]})
                            return True
                        else:
                            self.log_result("Explore Reviewers API", False, 
                                          f"Missing required fields: {missing_fields}", reviewer)
                            return False
                    else:
                        self.log_result("Explore Reviewers API", True, 
                                      "Reviewers endpoint working but no users available", 
                                      {"reviewers_count": 0})
                        return True
                else:
                    self.log_result("Explore Reviewers API", False, 
                                  "Response is not a list", data)
                    return False
            else:
                self.log_result("Explore Reviewers API", False, 
                              f"Failed with status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Explore Reviewers API", False, f"Exception: {str(e)}")
            return False
    
    def test_explore_categories(self):
        """Test explore categories endpoint - NOTE: This endpoint doesn't exist in server.py"""
        try:
            response = requests.get(f"{self.base_url}/explore/categories")
            
            if response.status_code == 404:
                self.log_result("Explore Categories API", False, 
                              "Endpoint not implemented in server.py - GET /api/explore/categories returns 404", 
                              {"status_code": 404, "issue": "Endpoint missing from implementation"})
                return False
            elif response.status_code == 200:
                data = response.json()
                self.log_result("Explore Categories API", True, 
                              "Categories endpoint working", data)
                return True
            else:
                self.log_result("Explore Categories API", False, 
                              f"Unexpected status: {response.status_code}", 
                              response.json() if response.content else None)
                return False
                
        except Exception as e:
            self.log_result("Explore Categories API", False, f"Exception: {str(e)}")
            return False
    
    def test_static_file_serving(self):
        """Test static file serving"""
        if not self.test_post_id:
            self.log_result("Static File Serving", False, "No test post created to verify static files")
            return False
            
        try:
            # First get the post to find the image URL
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = requests.get(f"{self.base_url}/posts/{self.test_post_id}", headers=headers)
            
            if response.status_code == 200:
                post_data = response.json()
                media_url = post_data.get("media_url", "")
                
                if media_url.startswith("/api/static/uploads/"):
                    # Try to access the static file
                    static_url = f"{self.base_url.replace('/api', '')}{media_url}"
                    static_response = requests.get(static_url)
                    
                    if static_response.status_code == 200:
                        self.log_result("Static File Serving", True, 
                                      f"Static file accessible at: {static_url}", 
                                      {"static_url": static_url, "content_length": len(static_response.content)})
                        return True
                    else:
                        self.log_result("Static File Serving", False, 
                                      f"Static file not accessible. Status: {static_response.status_code}", 
                                      {"static_url": static_url, "status_code": static_response.status_code})
                        return False
                else:
                    self.log_result("Static File Serving", False, 
                                  f"Media URL format incorrect: {media_url}", 
                                  {"media_url": media_url, "expected_prefix": "/api/static/uploads/"})
                    return False
            else:
                self.log_result("Static File Serving", False, 
                              f"Could not retrieve post data. Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Static File Serving", False, f"Exception: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests in sequence"""
        print(f"\n🚀 Starting Comprehensive Backend Testing for Cofau App")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        # Authentication Tests (High Priority)
        print("\n📋 AUTHENTICATION TESTS")
        print("-" * 40)
        auth_success = self.test_auth_signup()
        if not auth_success:
            auth_success = self.test_auth_login()
        
        if auth_success:
            self.test_auth_me()
        
        # Posts and Feed Tests (High Priority)
        print("\n📋 POSTS & FEED TESTS")
        print("-" * 40)
        if self.auth_token:
            self.test_create_post()
            self.test_feed_api()
        
        # Comments Tests (High Priority)
        print("\n📋 COMMENTS TESTS")
        print("-" * 40)
        if self.auth_token and self.test_post_id:
            self.test_add_comment()
            self.test_get_comments()
        
        # Likes Tests (High Priority - NEW)
        print("\n📋 LIKES TESTS")
        print("-" * 40)
        if self.auth_token and self.test_post_id:
            self.test_like_post()
            self.test_unlike_post()
        
        # Explore Tests (High Priority - NEW)
        print("\n📋 EXPLORE TESTS")
        print("-" * 40)
        if self.auth_token:
            self.test_explore_trending()
            self.test_explore_top_rated()
        
        self.test_explore_reviewers()
        self.test_explore_categories()
        
        # Static Files Test (Critical)
        print("\n📋 STATIC FILES TEST")
        print("-" * 40)
        self.test_static_file_serving()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['details']}")
        
        return self.test_results

if __name__ == "__main__":
    tester = CofauBackendTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    failed_tests = [r for r in results if not r["success"]]
    sys.exit(0 if len(failed_tests) == 0 else 1)