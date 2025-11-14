#!/usr/bin/env python3
"""
Debug test for comment endpoint
"""

import requests
import json

BASE_URL = "https://backend.cofau.com/api"

def test_comment_endpoint():
    # Create a test user first
    user_data = {
        "full_name": "Debug User",
        "email": f"debug_user_{int(__import__('time').time())}@test.com",
        "password": "TestPass123!"
    }
    
    response = requests.post(f"{BASE_URL}/auth/signup", json=user_data)
    if response.status_code != 200:
        print(f"Failed to create user: {response.text}")
        return
    
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create a post first
    test_image_content = b"fake_image_data_for_testing"
    data = {
        "rating": "9",
        "review_text": "Test post for comment debugging",
        "map_link": "https://maps.google.com/?q=Test+Location"
    }
    files = {
        "file": ("test_image.jpg", test_image_content, "image/jpeg")
    }
    
    response = requests.post(f"{BASE_URL}/posts/create", headers=headers, data=data, files=files)
    if response.status_code != 200:
        print(f"Failed to create post: {response.text}")
        return
    
    post_id = response.json()["post_id"]
    print(f"Created post: {post_id}")
    
    # Now test comment creation with different methods
    print("\n=== Testing JSON comment ===")
    comment_data = {"comment_text": "Great post!"}
    response = requests.post(f"{BASE_URL}/posts/{post_id}/comment", headers=headers, json=comment_data)
    print(f"JSON comment response: {response.status_code} - {response.text}")
    
    print("\n=== Testing Form data comment ===")
    comment_data = {"comment_text": "Another great comment!"}
    response = requests.post(f"{BASE_URL}/posts/{post_id}/comment", headers=headers, data=comment_data)
    print(f"Form data comment response: {response.status_code} - {response.text}")
    
    print("\n=== Testing multipart form comment ===")
    files = {"comment_text": (None, "Multipart comment!")}
    response = requests.post(f"{BASE_URL}/posts/{post_id}/comment", headers=headers, files=files)
    print(f"Multipart comment response: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_comment_endpoint()