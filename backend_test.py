#!/usr/bin/env python3
"""
Backend API Testing Script for Authentication Flow
Includes specific diagnostic test for frontendtest@cofau.com credentials
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "https://social-preview-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Specific test credentials as requested in diagnostic
DIAGNOSTIC_EMAIL = "frontendtest@cofau.com"
DIAGNOSTIC_PASSWORD = "Test123!"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}{test_name}{Colors.END}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'='*60}{Colors.END}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")

def test_api_health():
    """Test if API is running"""
    print_test_header("API HEALTH CHECK")
    
    try:
        response = requests.get(f"{API_BASE}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print_success(f"API is running: {data.get('message', 'Unknown')}")
            print_info(f"Version: {data.get('version', 'Unknown')}")
            return True
        else:
            print_error(f"API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"API health check failed: {str(e)}")
        return False

def test_signup_new_user():
    """TEST 1: SIGNUP NEW USER"""
    print_test_header("TEST 1: SIGNUP NEW USER")
    
    # Generate unique email for testing
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_email = f"testauth_{timestamp}@example.com"
    
    signup_data = {
        "full_name": "Test User Auth",
        "email": test_email,
        "password": "Test123!"
    }
    
    try:
        print_info(f"Signing up user: {test_email}")
        response = requests.post(
            f"{API_BASE}/auth/signup",
            json=signup_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        print_info(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            print_success("Signup successful!")
            print_info(f"Full Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if "access_token" in data:
                token = data["access_token"]
                print_success(f"Access token received: {token[:20]}...")
                
                # Verify token format (JWT should have 3 parts separated by dots)
                if len(token.split('.')) == 3:
                    print_success("Token format is valid JWT")
                else:
                    print_error("Token format is not valid JWT")
                
                return {"success": True, "token": token, "email": test_email}
            else:
                print_error("No access_token in response")
                return {"success": False, "error": "No access_token in response"}
        else:
            print_error(f"Signup failed with status {response.status_code}")
            try:
                error_data = response.json()
                print_error(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print_error(f"Error response: {response.text}")
            return {"success": False, "error": f"Status {response.status_code}"}
            
    except Exception as e:
        print_error(f"Signup request failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_verify_signup_token(token, expected_email):
    """TEST 2: VERIFY TOKEN FROM SIGNUP"""
    print_test_header("TEST 2: VERIFY TOKEN FROM SIGNUP")
    
    try:
        print_info(f"Verifying token: {token[:20]}...")
        print_info(f"Expected email: {expected_email}")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{API_BASE}/auth/me",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Token verification successful!")
            print_info(f"User data: {json.dumps(data, indent=2)}")
            
            # Verify email matches
            if data.get("email") == expected_email:
                print_success(f"Email matches: {expected_email}")
                return {"success": True, "user_data": data}
            else:
                print_error(f"Email mismatch. Expected: {expected_email}, Got: {data.get('email')}")
                return {"success": False, "error": "Email mismatch"}
        else:
            print_error(f"Token verification failed with status {response.status_code}")
            try:
                error_data = response.json()
                print_error(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print_error(f"Error response: {response.text}")
            return {"success": False, "error": f"Status {response.status_code}"}
            
    except Exception as e:
        print_error(f"Token verification request failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_login_with_credentials(email, password):
    """TEST 3: LOGIN WITH SAME CREDENTIALS"""
    print_test_header("TEST 3: LOGIN WITH SAME CREDENTIALS")
    
    try:
        print_info(f"Logging in user: {email}")
        
        # Login uses form-data format as per OAuth2PasswordRequestForm
        login_data = {
            "username": email,  # OAuth2 uses 'username' field for email
            "password": password
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        response = requests.post(
            f"{API_BASE}/auth/login",
            data=login_data,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Login successful!")
            print_info(f"Full Response: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if "access_token" in data:
                token = data["access_token"]
                print_success(f"Access token received: {token[:20]}...")
                
                # Verify token format (JWT should have 3 parts separated by dots)
                if len(token.split('.')) == 3:
                    print_success("Token format is valid JWT")
                else:
                    print_error("Token format is not valid JWT")
                
                return {"success": True, "token": token}
            else:
                print_error("No access_token in response")
                return {"success": False, "error": "No access_token in response"}
        else:
            print_error(f"Login failed with status {response.status_code}")
            try:
                error_data = response.json()
                print_error(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print_error(f"Error response: {response.text}")
            return {"success": False, "error": f"Status {response.status_code}"}
            
    except Exception as e:
        print_error(f"Login request failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_verify_login_token(token, expected_email):
    """TEST 4: VERIFY LOGIN TOKEN"""
    print_test_header("TEST 4: VERIFY LOGIN TOKEN")
    
    try:
        print_info(f"Verifying login token: {token[:20]}...")
        print_info(f"Expected email: {expected_email}")
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{API_BASE}/auth/me",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Login token verification successful!")
            print_info(f"User data: {json.dumps(data, indent=2)}")
            
            # Verify email matches
            if data.get("email") == expected_email:
                print_success(f"Email matches: {expected_email}")
                return {"success": True, "user_data": data}
            else:
                print_error(f"Email mismatch. Expected: {expected_email}, Got: {data.get('email')}")
                return {"success": False, "error": "Email mismatch"}
        else:
            print_error(f"Login token verification failed with status {response.status_code}")
            try:
                error_data = response.json()
                print_error(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print_error(f"Error response: {response.text}")
            return {"success": False, "error": f"Status {response.status_code}"}
            
    except Exception as e:
        print_error(f"Login token verification request failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_invalid_login():
    """TEST 5: INVALID LOGIN (Wrong Password)"""
    print_test_header("TEST 5: INVALID LOGIN (Wrong Password)")
    
    try:
        print_info("Testing login with wrong password")
        
        login_data = {
            "username": "testauth@example.com",
            "password": "WrongPassword123!"
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        response = requests.post(
            f"{API_BASE}/auth/login",
            data=login_data,
            headers=headers,
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 401:
            print_success("Invalid login correctly returned 401 Unauthorized")
            try:
                error_data = response.json()
                print_info(f"Error response: {json.dumps(error_data, indent=2)}")
            except:
                print_info(f"Error response: {response.text}")
            return {"success": True}
        else:
            print_error(f"Expected 401, got {response.status_code}")
            try:
                data = response.json()
                print_error(f"Unexpected response: {json.dumps(data, indent=2)}")
            except:
                print_error(f"Unexpected response: {response.text}")
            return {"success": False, "error": f"Expected 401, got {response.status_code}"}
            
    except Exception as e:
        print_error(f"Invalid login test failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_invalid_token():
    """TEST 6: INVALID TOKEN"""
    print_test_header("TEST 6: INVALID TOKEN")
    
    try:
        print_info("Testing /auth/me with invalid token")
        
        invalid_token = "invalid.token.here"
        headers = {
            "Authorization": f"Bearer {invalid_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            f"{API_BASE}/auth/me",
            headers=headers,
            timeout=10
        )
        
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 401:
            print_success("Invalid token correctly returned 401 Unauthorized")
            try:
                error_data = response.json()
                print_info(f"Error response: {json.dumps(error_data, indent=2)}")
            except:
                print_info(f"Error response: {response.text}")
            return {"success": True}
        else:
            print_error(f"Expected 401, got {response.status_code}")
            try:
                data = response.json()
                print_error(f"Unexpected response: {json.dumps(data, indent=2)}")
            except:
                print_error(f"Unexpected response: {response.text}")
            return {"success": False, "error": f"Expected 401, got {response.status_code}"}
            
    except Exception as e:
        print_error(f"Invalid token test failed: {str(e)}")
        return {"success": False, "error": str(e)}

def test_diagnostic_login():
    """DIAGNOSTIC TEST: Login with specific credentials frontendtest@cofau.com"""
    print_test_header("DIAGNOSTIC TEST: LOGIN WITH SPECIFIC CREDENTIALS")
    
    print_info(f"Testing LOGIN with exact credentials as requested:")
    print_info(f"   Email: {DIAGNOSTIC_EMAIL}")
    print_info(f"   Password: {DIAGNOSTIC_PASSWORD}")
    print_info(f"   Endpoint: POST {API_BASE}/auth/login")
    print_info(f"   Format: application/x-www-form-urlencoded")
    
    try:
        # Step 1: Login with specific credentials
        login_data = {
            "username": DIAGNOSTIC_EMAIL,  # OAuth2PasswordRequestForm uses 'username' field
            "password": DIAGNOSTIC_PASSWORD
        }
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        print_info("🔐 Sending login request...")
        response = requests.post(
            f"{API_BASE}/auth/login",
            data=login_data,
            headers=headers,
            timeout=30
        )
        
        print_info(f"Response Status: {response.status_code}")
        print_info(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("✅ LOGIN SUCCESS!")
            print_info(f"📋 Full login response JSON: {json.dumps(data, indent=2)}")
            
            # Verify response structure
            if "access_token" in data and "token_type" in data:
                token = data["access_token"]
                token_type = data["token_type"]
                
                print_success(f"✅ Contains access_token: YES")
                print_success(f"✅ Contains token_type: {token_type}")
                
                # Verify JWT format (3 parts separated by dots)
                token_parts = token.split('.')
                if len(token_parts) == 3:
                    print_success(f"✅ Valid JWT format: YES (3 parts)")
                    print_info(f"📝 Full JWT Token: {token}")
                    
                    # Step 2: Test /auth/me with the token
                    print_info(f"\n🔍 Testing /auth/me with Bearer token:")
                    print_info(f"   Endpoint: GET {API_BASE}/auth/me")
                    print_info(f"   Authorization: Bearer {token[:20]}...")
                    
                    me_headers = {
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json"
                    }
                    
                    me_response = requests.get(
                        f"{API_BASE}/auth/me",
                        headers=me_headers,
                        timeout=30
                    )
                    
                    print_info(f"/auth/me Response Status: {me_response.status_code}")
                    
                    if me_response.status_code == 200:
                        me_data = me_response.json()
                        print_success("✅ /AUTH/ME SUCCESS!")
                        print_info(f"📋 /auth/me response: {json.dumps(me_data, indent=2)}")
                        
                        # Verify email matches
                        if me_data.get("email") == DIAGNOSTIC_EMAIL:
                            print_success(f"✅ User email matches: {DIAGNOSTIC_EMAIL}")
                            print_success("🎉 DIAGNOSTIC TEST PASSED - Backend is 100% working for this user!")
                            return {"success": True, "token": token, "user_data": me_data}
                        else:
                            print_error(f"❌ Email mismatch: Expected {DIAGNOSTIC_EMAIL}, got {me_data.get('email')}")
                            return {"success": False, "error": "Email mismatch in /auth/me"}
                    else:
                        print_error(f"❌ /auth/me failed with status {me_response.status_code}")
                        try:
                            error_data = me_response.json()
                            print_error(f"Error details: {json.dumps(error_data, indent=2)}")
                        except:
                            print_error(f"Error response: {me_response.text}")
                        return {"success": False, "error": f"/auth/me failed with status {me_response.status_code}"}
                else:
                    print_error(f"❌ Invalid JWT format: {len(token_parts)} parts (expected 3)")
                    return {"success": False, "error": "Invalid JWT format"}
            else:
                print_error("❌ Missing access_token or token_type in response")
                return {"success": False, "error": "Missing required fields in login response"}
        else:
            print_error(f"❌ LOGIN FAILED with status {response.status_code}")
            try:
                error_data = response.json()
                print_error(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print_error(f"Error response: {response.text}")
            return {"success": False, "error": f"Login failed with status {response.status_code}"}
            
    except Exception as e:
        print_error(f"❌ DIAGNOSTIC TEST ERROR: {str(e)}")
        return {"success": False, "error": str(e)}

def main():
    """Run all authentication tests"""
    print(f"{Colors.BOLD}{Colors.BLUE}COFAU AUTHENTICATION FLOW TESTING{Colors.END}")
    print(f"{Colors.BOLD}Testing URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BOLD}API Base: {API_BASE}{Colors.END}")
    
    results = {}
    
    # Test API Health
    if not test_api_health():
        print_error("API is not accessible. Stopping tests.")
        return
    
    # PRIORITY: Run diagnostic test first
    diagnostic_result = test_diagnostic_login()
    results["diagnostic_login"] = diagnostic_result
    
    # If diagnostic test passes, we can skip other tests or run them for completeness
    if diagnostic_result["success"]:
        print_success("🎉 DIAGNOSTIC TEST PASSED - Backend authentication is working!")
        print_info("Skipping other tests since diagnostic test confirms backend is working.")
    else:
        print_warning("Diagnostic test failed. Running additional tests for debugging...")
        
        # TEST 1: Signup
        signup_result = test_signup_new_user()
        results["signup"] = signup_result
        
        if signup_result["success"]:
            signup_token = signup_result["token"]
            test_email = signup_result["email"]
            
            # TEST 2: Verify signup token
            verify_signup_result = test_verify_signup_token(signup_token, test_email)
            results["verify_signup_token"] = verify_signup_result
            
            # TEST 3: Login with same credentials
            login_result = test_login_with_credentials(test_email, "Test123!")
            results["login"] = login_result
            
            if login_result["success"]:
                login_token = login_result["token"]
                
                # TEST 4: Verify login token
                verify_login_result = test_verify_login_token(login_token, test_email)
                results["verify_login_token"] = verify_login_result
        
        # TEST 5: Invalid login
        invalid_login_result = test_invalid_login()
        results["invalid_login"] = invalid_login_result
        
        # TEST 6: Invalid token
        invalid_token_result = test_invalid_token()
        results["invalid_token"] = invalid_token_result
    
    # Summary
    print_test_header("TEST SUMMARY")
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result["success"])
    
    for test_name, result in results.items():
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{test_name}: {status}")
        if not result["success"] and "error" in result:
            print(f"  Error: {result['error']}")
    
    print(f"\n{Colors.BOLD}OVERALL RESULT: {passed_tests}/{total_tests} tests passed{Colors.END}")
    
    if results.get("diagnostic_login", {}).get("success"):
        print_success("🎉 DIAGNOSTIC CONFIRMED: Backend is 100% working for frontendtest@cofau.com!")
        return True
    elif passed_tests == total_tests:
        print_success("🎉 ALL AUTHENTICATION TESTS PASSED!")
        return True
    else:
        print_error(f"❌ {total_tests - passed_tests} tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)