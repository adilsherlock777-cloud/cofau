#!/usr/bin/env python3
"""
Quick test script to verify OpenAI API setup
"""

import os
import sys

print("=" * 60)
print("OpenAI API Test")
print("=" * 60)

# Test 1: Check environment variable
print("\n1. Checking OPENAI_API_KEY environment variable...")
from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print(f"   ✅ API Key found: {api_key[:20]}...")
else:
    print("   ❌ API Key NOT found in environment!")
    sys.exit(1)

# Test 2: Check openai package
print("\n2. Checking openai package...")
try:
    from openai import OpenAI
    print("   ✅ openai package imported successfully")
except ImportError as e:
    print(f"   ❌ Failed to import openai: {e}")
    print("\n   Run: pip install openai")
    sys.exit(1)

# Test 3: Initialize client
print("\n3. Initializing OpenAI client...")
try:
    client = OpenAI(api_key=api_key)
    print("   ✅ Client initialized successfully")
except Exception as e:
    print(f"   ❌ Failed to initialize client: {e}")
    sys.exit(1)

# Test 4: Test API with simple text prompt
print("\n4. Testing API with simple prompt...")
try:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "Say 'OK' if you receive this message."}
        ]
    )
    print(f"   ✅ API test successful!")
    print(f"   Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"   ❌ API test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 5: Test vision API with a simple image
print("\n5. Testing Vision API with image analysis...")
try:
    response = client.chat.completions.create(
        model="gpt-4o",  # gpt-4o has vision capabilities
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What's in this image? Just say 'Vision working!' if you can see it."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                        }
                    }
                ]
            }
        ],
        max_tokens=50
    )
    print(f"   ✅ Vision API test successful!")
    print(f"   Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"   ❌ Vision API test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All tests passed! OpenAI API is ready to use.")
print("=" * 60)
