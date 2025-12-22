#!/usr/bin/env python3
"""
Script to fetch and display posts from the last 3 days
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api"

# Test credentials
TEST_EMAIL = "frontendtest@cofau.com"
TEST_PASSWORD = "Test123!"

def signup():
    """Sign up a new test user"""
    print("📝 Creating test user...")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_email = f"test_{timestamp}@example.com"
    
    signup_data = {
        "full_name": "Test User",
        "email": test_email,
        "password": "Test123!"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/signup",
            json=signup_data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Signup successful! Email: {test_email}")
            return token
        else:
            print(f"❌ Signup failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Signup error: {str(e)}")
        return None

def login():
    """Login and get access token"""
    print("🔐 Logging in...")
    
    login_data = {
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/auth/login",
            data=login_data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"✅ Login successful!")
            return token
        else:
            print(f"⚠️  Login failed: {response.status_code}")
            print(f"   Trying to sign up a new user instead...")
            return None
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None

def fetch_last_3_days_posts(token):
    """Fetch posts from the last 3 days"""
    print("\n📊 Fetching posts from the last 3 days...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{API_BASE}/posts/last-3-days",
            headers=headers,
            timeout=30
        )
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            posts = response.json()
            print(f"✅ Successfully fetched {len(posts)} posts from the last 3 days\n")
            return posts
        else:
            print(f"❌ Failed to fetch posts: {response.status_code}")
            print(f"Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error fetching posts: {str(e)}")
        return None

def display_posts(posts):
    """Display posts in a readable format"""
    if not posts:
        print("No posts found.")
        return
    
    print("=" * 80)
    print(f"POSTS FROM THE LAST 3 DAYS ({len(posts)} total)")
    print("=" * 80)
    
    for i, post in enumerate(posts, 1):
        print(f"\n📌 Post #{i}")
        print(f"   ID: {post.get('id', 'N/A')}")
        print(f"   Username: {post.get('username', 'Unknown')}")
        print(f"   Rating: {post.get('rating', 0)}/10")
        print(f"   Review: {post.get('review_text', 'N/A')[:100]}...")
        print(f"   Location: {post.get('location_name', 'N/A')}")
        print(f"   Category: {post.get('category', 'N/A')}")
        print(f"   Media Type: {post.get('media_type', 'N/A')}")
        print(f"   Media URL: {post.get('media_url', 'N/A')}")
        print(f"   Likes: {post.get('likes_count', 0)}")
        print(f"   Comments: {post.get('comments_count', 0)}")
        print(f"   Created At: {post.get('created_at', 'N/A')}")
        print(f"   Is Liked: {post.get('is_liked_by_user', False)}")
        print(f"   Is Saved: {post.get('is_saved_by_user', False)}")
        print("-" * 80)
    
    # Also save to JSON file
    output_file = "last_3_days_posts.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n💾 Full data saved to: {output_file}")

def main():
    """Main function"""
    print("=" * 80)
    print("FETCHING POSTS FROM LAST 3 DAYS")
    print("=" * 80)
    
    # Step 1: Try to login, if fails, sign up a new user
    token = login()
    if not token:
        token = signup()
        if not token:
            print("❌ Cannot proceed without authentication token")
            sys.exit(1)
    
    # Step 2: Fetch posts
    posts = fetch_last_3_days_posts(token)
    if posts is None:
        print("❌ Failed to fetch posts")
        sys.exit(1)
    
    # Step 3: Display posts
    display_posts(posts)
    
    print("\n✅ Done!")

if __name__ == "__main__":
    main()

