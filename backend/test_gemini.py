#!/usr/bin/env python3
"""
Quick test script to verify Google Gemini API setup
"""

import os
import sys

print("=" * 60)
print("Google Gemini API Test")
print("=" * 60)

# Test 1: Check environment variable
print("\n1. Checking GOOGLE_GEMINI_API_KEY environment variable...")
from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
if api_key:
    print(f"   ✅ API Key found: {api_key[:20]}...")
else:
    print("   ❌ API Key NOT found in environment!")
    sys.exit(1)

# Test 2: Check google-generativeai package
print("\n2. Checking google-generativeai package...")
try:
    import google.generativeai as genai
    print("   ✅ google-generativeai package imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import google-generativeai: {e}")
    print("\n   Run: pip install google-generativeai==0.8.3")
    sys.exit(1)

# Test 3: Configure API
print("\n3. Configuring Gemini API...")
try:
    genai.configure(api_key=api_key)
    print("   ✅ API configured successfully")
except Exception as e:
    print(f"   ❌ Failed to configure API: {e}")
    sys.exit(1)

# Test 4: Test API with simple text prompt
print("\n4. Testing API with simple prompt...")
try:
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    response = model.generate_content("Hello! Just testing the API. Reply with 'OK'.")
    print(f"   ✅ API test successful!")
    print(f"   Response: {response.text[:100]}")
except Exception as e:
    print(f"   ❌ API test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All tests passed! Gemini API is ready to use.")
print("=" * 60)
