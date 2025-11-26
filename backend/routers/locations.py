from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from collections import defaultdict

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
        
        # Fetch all posts with non-empty location_name
        posts = await db.posts.find({
            "location_name": {"$exists": True, "$ne": None, "$ne": ""}
        }).to_list(None)
        
        print(f"📊 Found {len(posts)} posts with location_name")
        
        # Group posts by location_name
        location_data = defaultdict(lambda: {"uploads": 0, "images": [], "posts": []})
        
        for post in posts:
            location = post.get("location_name", "").strip()
            if not location:
                continue
            
            # Normalize location name to Title Case
            location = location.title()
            
            # Increment upload count
            location_data[location]["uploads"] += 1
            
            # Add post image if available and not already at limit (max 5 images)
            if post.get("media_url") and len(location_data[location]["images"]) < 5:
                location_data[location]["images"].append(post["media_url"])
            
            # Store post ID
            location_data[location]["posts"].append(str(post["_id"]))
        
        print(f"📍 Grouped into {len(location_data)} unique locations")
        
        # Convert to list and sort by uploads (descending)
        top_locations = [
            {
                "location": location,
                "location_name": location,  # Alias for consistency
                "uploads": data["uploads"],
                "images": data["images"][:5],  # Max 5 images for display
                "post_ids": data["posts"],  # All post IDs for this location
            }
            for location, data in location_data.items()
        ]
        
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
