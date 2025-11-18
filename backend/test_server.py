#!/usr/bin/env python3
"""Test script to check if server can start"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing server import...")
    from server import app
    print("✅ Server module imported successfully!")
    print(f"App: {app}")
    print(f"App title: {app.title}")
    print("✅ Server is ready to run!")
except Exception as e:
    print(f"❌ Error importing server: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

