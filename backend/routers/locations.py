from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from collections import defaultdict
from datetime import datetime
from bson import ObjectId

from database import get_database
from math import radians, cos, sin, asin, sqrt
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
        
        # Fetch all posts with location data from both collections
        # Sort by created_at descending (latest first) to get newest posts first
        location_query = {
            "$or": [
                {"location_name": {"$exists": True, "$ne": None, "$ne": ""}},
                {"map_link": {"$exists": True, "$ne": None, "$ne": ""}},
            ]
        }
        user_posts = await db.posts.find(location_query).sort("created_at", -1).to_list(None)
        restaurant_posts = await db.restaurant_posts.find(location_query).sort("created_at", -1).to_list(None)
        posts_with_location = user_posts + restaurant_posts
        posts_with_location.sort(key=lambda p: p.get("created_at") or datetime.min, reverse=True)

        print(f"📊 Found {len(posts_with_location)} posts with location data (user: {len(user_posts)}, restaurant: {len(restaurant_posts)})")
        
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
            
            # Get user details for this post
            user_id = post.get("user_id")
            user_level = None
            if user_id:
                try:
                    # Handle both string and ObjectId formats
                    user_id_obj = ObjectId(user_id) if isinstance(user_id, str) else user_id
                    user = await db.users.find_one({"_id": user_id_obj})
                    if user:
                        user_level = user.get("level", 1)
                except Exception as e:
                    print(f"⚠️ Error fetching user level for post: {str(e)}")
                    pass
            
            # Add post image with creation date and user level for sorting
            media_url = post.get("media_url") or post.get("image_url")
            thumbnail_url = post.get("thumbnail_url")
            media_type = post.get("media_type", "image")
            
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
                
                # Store image with date, user level, and media info for later sorting
                location_data[location]["images_with_dates"].append({
                    "url": media_url,
                    "thumbnail_url": thumbnail_url,
                    "media_type": media_type,
                    "user_level": user_level,
                    "dish_name": post.get("dish_name"),
                    "clicks_count": post.get("clicks_count", 0),
                    "views_count": post.get("views_count", 0),
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
            
            # Extract image data with user levels, keeping the latest first order
            images_data = []
            thumbnails = []
            for img in sorted_images[:8]:  # Get top 8 latest images
                thumbnail_url = img.get("thumbnail_url")
                images_data.append({
                    "url": img["url"],
                    "thumbnail_url": thumbnail_url,  # Include thumbnail in images_data
                    "user_level": img.get("user_level", 1),
                    "media_type": img.get("media_type", "image"),
                    "dish_name": img.get("dish_name"),
                    "clicks_count": img.get("clicks_count", 0),
                    "views_count": img.get("views_count", 0),
                })
                thumbnails.append(thumbnail_url)
            
            # For backward compatibility, also include simple URL arrays
            images = [img["url"] for img in sorted_images[:8]]
            
            top_locations.append({
                "location": location,
                "location_name": location,  # Alias for consistency
                "uploads": data["uploads"],
                "images": images,  # Simple URL array for backward compatibility
                "images_data": images_data,  # Full image data with user levels
                "thumbnails": thumbnails,  # Thumbnail URLs for videos
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

        # Find all posts for this location from both collections
        location_regex = {"$regex": f"^{location_normalized}$", "$options": "i"}
        user_posts = await db.posts.find({
            "location_name": location_regex
        }).sort("created_at", -1).to_list(None)
        restaurant_posts = await db.restaurant_posts.find({
            "location_name": location_regex
        }).sort("created_at", -1).to_list(None)
        posts = user_posts + restaurant_posts
        posts.sort(key=lambda p: p.get("created_at") or datetime.min, reverse=True)

        # Format posts
        formatted_posts = []
        for post in posts:
            # Get user details - handle both user_id and restaurant_id
            user = None
            user_id = post.get("user_id") or post.get("restaurant_id")
            if user_id:
                try:
                    user_id_obj = ObjectId(user_id) if isinstance(user_id, str) else user_id
                    user = await db.users.find_one({"_id": user_id_obj})
                except Exception:
                    pass

            formatted_posts.append({
                "id": str(post["_id"]),
                "media_url": post.get("media_url"),
                "image_url": post.get("image_url") or post.get("media_url"),
                "thumbnail_url": post.get("thumbnail_url"),
                "rating": post.get("rating"),
                "review_text": post.get("review_text"),
                "location_name": post.get("location_name"),
                "location": post.get("location_name"),  # For backward compatibility
                "media_type": post.get("media_type", "image"),
                "dish_name": post.get("dish_name"),
                "clicks_count": post.get("clicks_count", 0),
                "views_count": post.get("views_count", 0),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "created_at": post.get("created_at").isoformat() if post.get("created_at") else None,
                "user_id": str(user_id) if user_id else "",
                "user": {
                    "id": str(user["_id"]) if user else None,
                    "username": user.get("full_name") or user.get("username") if user else "Unknown",
                    "profile_picture": user.get("profile_picture") if user else None,
                    "level": user.get("level", 1) if user else 1,
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

def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km"""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return float('inf')
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return km


@router.get("/nearby")
async def get_nearby_locations(
    lat: float,
    lng: float,
    radius_km: float = 50,  # Large radius for now since you have less data
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Get top locations near user's position.
    Groups posts by location_name, counts uploads, sorts by count (highest first).
    Returns locations with preview images.
    """
    db = get_database()
    
    # Get all posts with location_name from both collections
    location_name_query = {"location_name": {"$exists": True, "$ne": None, "$ne": ""}}
    user_posts = await db.posts.find(location_name_query).to_list(None)
    restaurant_posts = await db.restaurant_posts.find(location_name_query).to_list(None)
    all_posts = user_posts + restaurant_posts
    
    # Group posts by location_name and calculate distance
    location_map = {}
    
    for post in all_posts:
        location_name = post.get("location_name")
        if not location_name:
            continue
        
        # Calculate distance if post has coordinates
        post_lat = post.get("latitude")
        post_lng = post.get("longitude")
        
        if post_lat and post_lng:
            distance = haversine(lat, lng, post_lat, post_lng)
        else:
            # If no coordinates, include but with large distance
            # This ensures posts without coordinates still show up
            distance = radius_km - 1  # Just inside radius
        
        # Skip if outside radius
        if distance > radius_km:
            continue
        
        # Initialize location entry if not exists
        if location_name not in location_map:
            location_map[location_name] = {
                "location": location_name,
                "location_name": location_name,
                "uploads": 0,
                "images": [],
                "thumbnails": [],
                "images_data": [],
                "map_link": None,
                "min_distance": distance,
                "avg_rating": [],
            }
        
        # Update location data
        loc_data = location_map[location_name]
        loc_data["uploads"] += 1
        
        # Update min distance
        if distance < loc_data["min_distance"]:
            loc_data["min_distance"] = distance
        
        # Collect images (limit to 20 per location)
        if len(loc_data["images"]) < 20:
            media_url = post.get("media_url") or post.get("image_url")
            if media_url:
                loc_data["images"].append(media_url)
                loc_data["thumbnails"].append(post.get("thumbnail_url"))
                loc_data["images_data"].append({
                    "media_url": media_url,
                    "thumbnail_url": post.get("thumbnail_url"),
                    "media_type": post.get("media_type", "image"),
                    "post_id": str(post["_id"]),
                    "dish_name": post.get("dish_name"),
                    "clicks_count": post.get("clicks_count", 0),
                    "views_count": post.get("views_count", 0),
                })
        
        # Collect map_link if not set
        if not loc_data["map_link"] and post.get("map_link"):
            loc_data["map_link"] = post.get("map_link")
        
        # Collect rating for average
        if post.get("rating"):
            loc_data["avg_rating"].append(post.get("rating"))
    
    # Convert to list and calculate average ratings
    locations_list = []
    for loc_name, loc_data in location_map.items():
        # Calculate average rating
        ratings = loc_data["avg_rating"]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        
        locations_list.append({
            "location": loc_data["location"],
            "location_name": loc_data["location_name"],
            "uploads": loc_data["uploads"],
            "images": loc_data["images"],
            "thumbnails": loc_data["thumbnails"],
            "images_data": loc_data["images_data"],
            "map_link": loc_data["map_link"],
            "distance_km": round(loc_data["min_distance"], 2),
            "average_rating": round(avg_rating, 1),
        })
    
    # Sort by uploads (highest first)
    locations_list.sort(key=lambda x: x["uploads"], reverse=True)
    
    # Limit results
    return locations_list[:limit]