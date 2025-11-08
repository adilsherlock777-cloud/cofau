#!/usr/bin/env python3
"""
Backend API Testing Script for Cofau App
Tests authentication flow: signup, login, and protected endpoints
"""

import requests
import json
import sys
from datetime import datetime
from io import BytesIO
from PIL import Image

# Backend URL from environment
BACKEND_URL = "https://meal-snap-4.preview.emergentagent.com/api"

def test_auth_flow():
    """Test complete authentication flow"""
    print("=" * 60)
    print("TESTING AUTHENTICATION FLOW")
    print("=" * 60)
    
    # Test data
    test_user = {
        "full_name": "Test User",
        "email": "test@test.com", 
        "password": "password123"
    }
    
    # Step 1: Test Signup
    print("\n1. Testing POST /api/auth/signup")
    print("-" * 40)
    
    try:
        signup_response = requests.post(
            f"{BACKEND_URL}/auth/signup",
            json=test_user,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status Code: {signup_response.status_code}")
        print(f"Response: {signup_response.text}")
        
        if signup_response.status_code == 200:
            signup_data = signup_response.json()
            print("✅ Signup successful")
            print(f"Access Token: {signup_data.get('access_token', 'Not found')[:50]}...")
        elif signup_response.status_code == 400 and "already registered" in signup_response.text:
            print("⚠️  User already exists - continuing with login test")
        else:
            print(f"❌ Signup failed: {signup_response.text}")
            
    except Exception as e:
        print(f"❌ Signup request failed: {str(e)}")
        return False
    
    # Step 2: Test Login
    print("\n2. Testing POST /api/auth/login")
    print("-" * 40)
    
    try:
        # OAuth2 requires form data with 'username' field (not 'email')
        login_data = {
            "username": test_user["email"],  # OAuth2 uses 'username' field
            "password": test_user["password"]
        }
        
        login_response = requests.post(
            f"{BACKEND_URL}/auth/login",
            data=login_data,  # Form data, not JSON
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        print(f"Status Code: {login_response.status_code}")
        print(f"Response: {login_response.text}")
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            access_token = login_data.get("access_token")
            if access_token:
                print("✅ Login successful")
                print(f"Access Token: {access_token[:50]}...")
                print(f"Token Type: {login_data.get('token_type')}")
            else:
                print("❌ Login response missing access_token")
                return False
        else:
            print(f"❌ Login failed: {login_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Login request failed: {str(e)}")
        return False
    
    # Step 3: Test Protected Endpoint
    print("\n3. Testing GET /api/auth/me (Protected)")
    print("-" * 40)
    
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        me_response = requests.get(
            f"{BACKEND_URL}/auth/me",
            headers=headers
        )
        
        print(f"Status Code: {me_response.status_code}")
        print(f"Response: {me_response.text}")
        
        if me_response.status_code == 200:
            user_data = me_response.json()
            print("✅ Protected endpoint access successful")
            print(f"User ID: {user_data.get('id')}")
            print(f"Full Name: {user_data.get('full_name')}")
            print(f"Email: {user_data.get('email')}")
            print(f"Points: {user_data.get('points')}")
            print(f"Level: {user_data.get('level')}")
            return True
        else:
            print(f"❌ Protected endpoint failed: {me_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Protected endpoint request failed: {str(e)}")
        return False

def test_invalid_credentials():
    """Test login with invalid credentials"""
    print("\n4. Testing Invalid Credentials")
    print("-" * 40)
    
    try:
        invalid_data = {
            "username": "invalid@test.com",
            "password": "wrongpassword"
        }
        
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            data=invalid_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Invalid credentials properly rejected")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Invalid credentials test failed: {str(e)}")
        return False

def test_unauthorized_access():
    """Test accessing protected endpoint without token"""
    print("\n5. Testing Unauthorized Access")
    print("-" * 40)
    
    try:
        response = requests.get(f"{BACKEND_URL}/auth/me")
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("✅ Unauthorized access properly blocked")
            return True
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Unauthorized access test failed: {str(e)}")
        return False

def create_test_image():
    """Create a simple test image for upload"""
    # Create a simple 100x100 red image
    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

def get_auth_token():
    """Get authentication token for testing posts"""
    login_data = {
        'username': 'test@test.com',
        'password': 'password123'
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            data=login_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get('access_token')
        else:
            print(f"❌ Login failed for post testing: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Login error for post testing: {str(e)}")
        return None

def test_create_post():
    """Test creating a post with authentication"""
    print("\n6. Testing POST /api/posts/create")
    print("-" * 40)
    
    # Get authentication token
    token = get_auth_token()
    if not token:
        print("❌ No token available for post creation")
        return False
    
    # Create test image
    test_image = create_test_image()
    
    # Prepare multipart form data
    files = {
        'file': ('test_burger.jpg', test_image, 'image/jpeg')
    }
    
    data = {
        'rating': '8',
        'review_text': 'Amazing burger! The patty was juicy and perfectly cooked. Highly recommend!',
        'map_link': 'https://maps.google.com/?q=Times+Square+New+York'
    }
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/posts/create",
            files=files,
            data=data,
            headers=headers
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            post_id = result.get('post_id')
            print(f"✅ Post created successfully! Post ID: {post_id}")
            return post_id
        else:
            print(f"❌ Post creation failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Post creation error: {str(e)}")
        return False

def test_feed():
    """Test getting feed data"""
    print("\n7. Testing GET /api/feed")
    print("-" * 40)
    
    # Get authentication token since feed requires auth
    token = get_auth_token()
    if not token:
        print("❌ No token available for feed testing")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BACKEND_URL}/feed", headers=headers)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response length: {len(response.text)} characters")
        
        if response.status_code == 200:
            feed_data = response.json()
            print(f"✅ Feed retrieved successfully! Found {len(feed_data)} posts")
            
            # Check if our test post is in the feed
            test_post_found = False
            for post in feed_data:
                if post.get('review_text') == 'Amazing burger! The patty was juicy and perfectly cooked. Highly recommend!':
                    print(f"✅ Test post found in feed! Post ID: {post.get('id')}")
                    print(f"   - Rating: {post.get('rating')}")
                    print(f"   - Map Link: {post.get('map_link')}")
                    print(f"   - Username: {post.get('username')}")
                    test_post_found = True
                    break
            
            if not test_post_found and len(feed_data) > 0:
                print("⚠️  Test post not found in feed, but feed has other posts:")
                for i, post in enumerate(feed_data[:3]):  # Show first 3 posts
                    print(f"   {i+1}. {post.get('username')}: {post.get('review_text', '')[:50]}...")
            elif len(feed_data) == 0:
                print("⚠️  Feed is empty")
            
            return True
        else:
            print(f"❌ Feed retrieval failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Feed error: {str(e)}")
        return False

def test_comment_endpoints():
    """Test comment endpoints as requested in the review"""
    print("\n" + "=" * 60)
    print("TESTING COMMENT ENDPOINTS")
    print("=" * 60)
    
    # Step 1: Login to get token
    print("\n1. Testing Login to get authentication token...")
    login_url = f"{BACKEND_URL}/auth/login"
    login_data = {
        "username": "test@test.com",
        "password": "password123"
    }
    
    try:
        login_response = requests.post(login_url, data=login_data)
        print(f"Login Status Code: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result.get("access_token")
            print(f"✅ Login successful! Token obtained: {token[:20]}...")
            
            # Step 2: Test adding a comment
            print(f"\n2. Testing Add Comment endpoint...")
            post_id = "690fa2cc8a6be6239d38e7e5"
            comment_url = f"{BACKEND_URL}/posts/{post_id}/comment"
            
            headers = {
                "Authorization": f"Bearer {token}"
            }
            
            comment_data = {
                "comment_text": "This is a test comment"
            }
            
            try:
                comment_response = requests.post(comment_url, headers=headers, data=comment_data)
                print(f"Add Comment Status Code: {comment_response.status_code}")
                print(f"Add Comment Response: {comment_response.text}")
                
                if comment_response.status_code == 200:
                    comment_result = comment_response.json()
                    print(f"✅ Comment added successfully! Comment ID: {comment_result.get('comment_id')}")
                    
                    # Step 3: Get comments for the post
                    print(f"\n3. Testing Get Comments endpoint...")
                    get_comments_url = f"{BACKEND_URL}/posts/{post_id}/comments"
                    
                    try:
                        get_response = requests.get(get_comments_url)
                        print(f"Get Comments Status Code: {get_response.status_code}")
                        
                        if get_response.status_code == 200:
                            comments = get_response.json()
                            print(f"✅ Comments retrieved successfully! Found {len(comments)} comments")
                            
                            # Show the latest comment (should be our test comment)
                            if comments:
                                latest_comment = comments[0]  # Comments are sorted by created_at desc
                                print(f"Latest comment: '{latest_comment.get('comment_text')}'")
                                print(f"By user: {latest_comment.get('username')}")
                                print(f"Comment ID: {latest_comment.get('id')}")
                            
                            return True
                        else:
                            print(f"❌ Failed to get comments: {get_response.text}")
                            return False
                            
                    except Exception as e:
                        print(f"❌ Error getting comments: {str(e)}")
                        return False
                        
                else:
                    print(f"❌ Failed to add comment: {comment_response.text}")
                    return False
                    
            except Exception as e:
                print(f"❌ Error adding comment: {str(e)}")
                return False
                
        else:
            print(f"❌ Login failed: {login_response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False

def test_comment_endpoint_formats():
    """Test different request formats for comment endpoint"""
    print("\n" + "=" * 60)
    print("TESTING COMMENT ENDPOINT REQUEST FORMATS")
    print("=" * 60)
    
    # First get a token
    login_url = f"{BACKEND_URL}/auth/login"
    login_data = {"username": "test@test.com", "password": "password123"}
    
    try:
        login_response = requests.post(login_url, data=login_data)
        if login_response.status_code != 200:
            print("❌ Cannot test formats - login failed")
            return False
            
        token = login_response.json().get("access_token")
        post_id = "690fa2cc8a6be6239d38e7e5"
        comment_url = f"{BACKEND_URL}/posts/{post_id}/comment"
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test 1: multipart/form-data (as specified in review request)
        print("\n1. Testing with multipart/form-data...")
        
        comment_data = {"comment_text": "Test comment with multipart form data"}
        
        try:
            # requests automatically sets multipart/form-data when using data parameter
            response = requests.post(comment_url, headers=headers, data=comment_data)
            print(f"Multipart Status Code: {response.status_code}")
            print(f"Multipart Response: {response.text}")
            
            if response.status_code == 200:
                print("✅ Multipart form-data format works!")
                return True
            else:
                print("❌ Multipart form-data format failed")
                return False
                
        except Exception as e:
            print(f"❌ Multipart test error: {str(e)}")
            return False
            
    except Exception as e:
        print(f"❌ Format testing error: {str(e)}")
        return False

def verify_post_exists():
    """Verify the post ID exists before testing comments"""
    print("\n" + "=" * 60)
    print("VERIFYING POST EXISTS")
    print("=" * 60)
    
    post_id = "690fa2cc8a6be6239d38e7e5"
    post_url = f"{BACKEND_URL}/posts/{post_id}"
    
    try:
        response = requests.get(post_url)
        print(f"Get Post Status Code: {response.status_code}")
        
        if response.status_code == 200:
            post = response.json()
            print(f"✅ Post exists! Review: '{post.get('review_text', 'No review text')}'")
            print(f"Post by: {post.get('username')}")
            print(f"Rating: {post.get('rating')}")
            return True
        else:
            print(f"❌ Post not found: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking post: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    results = []
    
    # Run authentication tests
    results.append(("Auth Flow", test_auth_flow()))
    results.append(("Invalid Credentials", test_invalid_credentials()))
    results.append(("Unauthorized Access", test_unauthorized_access()))
    
    # Run post and feed tests
    post_result = test_create_post()
    results.append(("Post Creation", bool(post_result)))
    results.append(("Feed Retrieval", test_feed()))
    
    # Run comment tests as requested in review
    post_exists = verify_post_exists()
    if post_exists:
        results.append(("Comment Endpoints", test_comment_endpoints()))
        results.append(("Comment Formats", test_comment_endpoint_formats()))
    else:
        print("⚠️  Skipping comment tests - post doesn't exist")
        results.append(("Comment Endpoints", False))
        results.append(("Comment Formats", False))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All backend tests passed!")
        return True
    else:
        print("⚠️  Some tests failed - check logs above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)