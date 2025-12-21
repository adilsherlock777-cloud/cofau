from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from collections import defaultdict
from datetime import datetime

from database import get_database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/locations", tags=["locations"])


@router.get("/top")
async def get_top_locations(
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get top locations by post count
    
    Returns:
    - Top N locations sorted by upload count
    - Each location includes: name, uploads count, and sample images
    """
    try:
        db = get_database()
        
        print("🔍 Fetching top locations...")
        
        # Fetch all posts with location data (check multiple fields)
        # Sort by created_at descending (latest first) to get newest posts first
        posts_with_location = await db.posts.find({
            "$or": [
                {"location_name": {"$exists": True, "$ne": None, "$ne": ""}},
                {"map_link": {"$exists": True, "$ne": None, "$ne": ""}},
            ]
        }).sort("created_at", -1).to_list(None)  # Sort by created_at descending (latest first)
        
        print(f"📊 Found {len(posts_with_location)} posts with location data")
        
        # Group posts by location_name
        # Store images with their creation dates for sorting
        location_data = defaultdict(lambda: {"uploads": 0, "images": [], "images_with_dates": [], "posts": []})
        
        for post in posts_with_location:
            # Try location_name first
            location = post.get("location_name", "").strip()
            
            # If no location_name, try to extract from map_link
            if not location and post.get("map_link"):
                map_link = post.get("map_link", "")
                # Try to extract location name from Google Maps URL
                # Example: https://maps.google.com/?q=Restaurant+Name
                if "q=" in map_link:
                    try:
                        import urllib.parse
                        parsed = urllib.parse.urlparse(map_link)
                        params = urllib.parse.parse_qs(parsed.query)
                        if "q" in params:
                            location = params["q"][0].replace("+", " ").strip()
                    except:
                        pass
            
            # Skip if still no location
            if not location:
                continue
            
            # Normalize location name to Title Case
            location = location.title()
            
            # Increment upload count
            location_data[location]["uploads"] += 1
            
            # Add post image with creation date for sorting
            media_url = post.get("media_url") or post.get("image_url")
            if media_url:
                # Get creation date for sorting
                created_at = post.get("created_at")
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        created_at = None
                elif created_at is None:
                    created_at = None
                
                # Store image with date for later sorting
                location_data[location]["images_with_dates"].append({
                    "url": media_url,
                    "created_at": created_at if created_at else datetime.utcnow()  # Use current time as fallback
                })
            
            # Store post ID
            location_data[location]["posts"].append(str(post["_id"]))
        
        print(f"📍 Grouped into {len(location_data)} unique locations")
        
        # Convert to list and sort images by date (latest first), then sort locations by uploads
        top_locations = []
        for location, data in location_data.items():
            # Sort images by created_at descending (latest first)
            sorted_images = sorted(
                data["images_with_dates"],
                key=lambda x: x["created_at"],
                reverse=True  # Latest first
            )
            
            # Extract just the URLs, keeping the latest first order
            images = [img["url"] for img in sorted_images[:8]]  # Get top 8 latest images
            
            top_locations.append({
                "location": location,
                "location_name": location,  # Alias for consistency
                "uploads": data["uploads"],
                "images": images,  # Already sorted by latest first
                "post_ids": data["posts"],  # All post IDs for this location
            })
        
        # Sort by uploads count (descending)
        top_locations.sort(key=lambda x: x["uploads"], reverse=True)
        
        # Return top N locations
        result = top_locations[:limit]
        print(f"✅ Returning {len(result)} top locations")
        for loc in result:
            print(f"   - {loc['location']}: {loc['uploads']} uploads, {len(loc['images'])} images")
        
        return result
    
    except Exception as e:
        print(f"❌ Error fetching top locations: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


@router.get("/details/{location_name}")
async def get_location_details(
    location_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information about a specific location
    
    Returns:
    - All posts for this location
    - Upload statistics
    """
    try:
        db = get_database()
        
        # Normalize location name
        location_normalized = location_name.strip().title()
        
        # Find all posts for this location (search by location_name)
        posts = await db.posts.find({
            "location_name": {"$regex": f"^{location_normalized}$", "$options": "i"}
        }).sort("created_at", -1).to_list(None)
        
        # Format posts
        formatted_posts = []
        for post in posts:
            # Get user details
            user = await db.users.find_one({"_id": post["user_id"]})
            
            formatted_posts.append({
                "id": str(post["_id"]),
                "media_url": post.get("media_url"),
                "image_url": post.get("image_url") or post.get("media_url"),
                "rating": post.get("rating"),
                "review_text": post.get("review_text"),
                "location_name": post.get("location_name"),
                "location": post.get("location_name"),  # For backward compatibility
                "media_type": post.get("media_type", "image"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "created_at": post.get("created_at").isoformat() if post.get("created_at") else None,
                "user_id": str(post.get("user_id", "")),
                "user": {
                    "id": str(user["_id"]) if user else None,
                    "username": user.get("full_name") or user.get("username") if user else "Unknown",
                    "profile_picture": user.get("profile_picture") if user else None,
                }
            })
        
        return {
            "location": location_normalized,
            "uploads": len(formatted_posts),
            "posts": formatted_posts
        }
    
    except Exception as e:
        print(f"❌ Error fetching location details: {str(e)}")
        return {
            "location": location_name,
            "uploads": 0,
            "posts": []
        }
