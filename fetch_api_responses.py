#!/usr/bin/env python3
"""
Script to fetch responses from three API endpoints:
1. /api/feed
2. /api/stories/feed (note: it's /api/stories/feed, not /api/story/feed)
3. /api/users/{id}
"""

import json
import sys
import urllib.request
import urllib.error
from typing import Optional

# API Configuration
PRODUCTION_URL = "https://backend.cofau.com"
LOCAL_URL = "http://localhost:8000"

def get_base_url():
    """Try local first, then production"""
    try:
        req = urllib.request.Request(f"{LOCAL_URL}/api")
        with urllib.request.urlopen(req, timeout=2) as response:
            if response.status == 200:
                print(f"✅ Using local server: {LOCAL_URL}")
                return LOCAL_URL
    except:
        pass
    
    print(f"✅ Using production server: {PRODUCTION_URL}")
    return PRODUCTION_URL

def fetch_with_auth(url: str, token: Optional[str] = None) -> dict:
    """Fetch from API with optional authentication"""
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = response.read().decode('utf-8')
            return json.loads(data)
    except urllib.error.HTTPError as e:
        error_data = e.read().decode('utf-8')
        try:
            error_json = json.loads(error_data)
            return {
                "error": error_json.get("detail", str(e)),
                "status_code": e.code,
                "message": "Failed to fetch. This endpoint may require authentication."
            }
        except:
            return {
                "error": str(e),
                "status_code": e.code,
                "message": "Failed to fetch. This endpoint may require authentication."
            }
    except Exception as e:
        return {
            "error": str(e),
            "status_code": None,
            "message": "Failed to fetch. This endpoint may require authentication."
        }

def main():
    base_url = get_base_url()
    api_base = f"{base_url}/api"
    
    # Get token from user if needed
    token = None
    print("\n" + "="*60)
    print("API Response Fetcher")
    print("="*60)
    print("\nNote: These endpoints require authentication.")
    print("Trying without token first to show response structure...")
    
    results = {}
    
    # 1. Fetch /api/feed
    print("\n" + "-"*60)
    print("1️⃣ Fetching /api/feed")
    print("-"*60)
    feed_url = f"{api_base}/feed"
    feed_response = fetch_with_auth(feed_url, token)
    results["feed"] = feed_response
    print(f"Status: {'✅ Success' if 'error' not in feed_response else '❌ Error'}")
    if 'error' not in feed_response:
        print(f"Posts returned: {len(feed_response) if isinstance(feed_response, list) else 'N/A'}")
        # Extract a user_id from feed if available
        user_id = None
        if isinstance(feed_response, list) and len(feed_response) > 0:
            user_id = feed_response[0].get("user_id")
            print(f"Sample user_id from feed: {user_id}")
    else:
        print(f"Error: {feed_response.get('error')}")
    
    # 2. Fetch /api/stories/feed
    print("\n" + "-"*60)
    print("2️⃣ Fetching /api/stories/feed")
    print("-"*60)
    stories_url = f"{api_base}/stories/feed"
    stories_response = fetch_with_auth(stories_url, token)
    results["stories_feed"] = stories_response
    print(f"Status: {'✅ Success' if 'error' not in stories_response else '❌ Error'}")
    if 'error' not in stories_response:
        print(f"Users with stories: {len(stories_response) if isinstance(stories_response, list) else 'N/A'}")
    else:
        print(f"Error: {stories_response.get('error')}")
    
    # 3. Fetch /api/users/{id}
    print("\n" + "-"*60)
    print("3️⃣ Fetching /api/users/{id}")
    print("-"*60)
    
    # Try to get user_id from feed, or use a placeholder
    user_id = None
    if isinstance(feed_response, list) and len(feed_response) > 0:
        user_id = feed_response[0].get("user_id")
        print(f"Using user_id from feed: {user_id}")
    else:
        # Use a placeholder user_id for demonstration
        user_id = "000000000000000000000000"  # Placeholder ObjectId
        print(f"Using placeholder user_id: {user_id}")
    
    if user_id:
        user_url = f"{api_base}/users/{user_id}"
        user_response = fetch_with_auth(user_url, token)
        results["user"] = user_response
        print(f"Status: {'✅ Success' if 'error' not in user_response else '❌ Error'}")
        if 'error' not in user_response:
            print(f"User: {user_response.get('full_name', 'N/A')}")
        else:
            print(f"Error: {user_response.get('error')}")
    else:
        print("Skipping user endpoint (no user_id provided)")
        results["user"] = {"message": "Skipped - no user_id provided"}
    
    # Save results to file
    output_file = "api_responses.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, default=str)
    
    print("\n" + "="*60)
    print(f"✅ Results saved to: {output_file}")
    print("="*60)
    
    # Print summary
    print("\n📋 Summary:")
    print(json.dumps(results, indent=2, default=str))
    
    return results

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

