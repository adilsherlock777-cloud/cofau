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
BACKEND_URL = "https://food-app-debug.preview.emergentagent.com/api"

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

def main():
    """Run all authentication tests"""
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Test started at: {datetime.now()}")
    
    results = []
    
    # Run tests
    results.append(("Auth Flow", test_auth_flow()))
    results.append(("Invalid Credentials", test_invalid_credentials()))
    results.append(("Unauthorized Access", test_unauthorized_access()))
    
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
        print("🎉 All authentication tests passed!")
        return True
    else:
        print("⚠️  Some tests failed - check logs above")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)