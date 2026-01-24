# ======================================================
# MAP ROUTER - Add this file as: routers/map.py
# ======================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
import re
import math
import httpx
from urllib.parse import unquote, urlparse, parse_qs

from database import get_database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/map", tags=["Map"])

# ======================================================
# CONFIGURATION - Add your Google API Key here
# ======================================================
GOOGLE_GEOCODING_API_KEY = "AIzaSyDLBWLLuXT7hMU2LySIervGx6b2iZwWqyE"

# ======================================================
# UTILITY FUNCTIONS
# ======================================================

def extract_coordinates_from_map_link(map_link: str) -> dict:
    """
    Extract latitude and longitude from various Google Maps URL formats.
    
    Supports:
    1. https://www.google.com/maps/search?api=1&query=Place+Name (needs geocoding)
    2. https://www.google.com/maps/place/.../@12.9716,77.5946,17z/...
    3. https://maps.google.com/?q=12.9716,77.5946
    4. https://www.google.com/maps?q=12.9716,77.5946
    5. https://goo.gl/maps/... (shortened - needs API call)
    
    Returns: {"latitude": float, "longitude": float, "needs_geocoding": bool, "query": str}
    """
    if not map_link:
        return None
    
    try:
        # Pattern 1: Direct coordinates in URL path (@lat,lng)
        # Example: /maps/place/Restaurant/@12.9716,77.5946,17z/
        coord_pattern = r'@(-?\d+\.?\d*),(-?\d+\.?\d*)'
        match = re.search(coord_pattern, map_link)
        if match:
            return {
                "latitude": float(match.group(1)),
                "longitude": float(match.group(2)),
                "needs_geocoding": False,
                "query": None
            }
        
        # Pattern 2: Coordinates in query parameter (?q=lat,lng)
        # Example: ?q=12.9716,77.5946
        q_coord_pattern = r'[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)'
        match = re.search(q_coord_pattern, map_link)
        if match:
            return {
                "latitude": float(match.group(1)),
                "longitude": float(match.group(2)),
                "needs_geocoding": False,
                "query": None
            }
        
        # Pattern 3: Search query format (needs geocoding)
        # Example: /maps/search?api=1&query=Blackbox%20pizza%20Nagarbhavi
        if 'query=' in map_link:
            parsed = urlparse(map_link)
            query_params = parse_qs(parsed.query)
            if 'query' in query_params:
                place_query = unquote(query_params['query'][0])
                return {
                    "latitude": None,
                    "longitude": None,
                    "needs_geocoding": True,
                    "query": place_query
                }
        
        # Pattern 4: Place name in URL path
        # Example: /maps/place/Blackbox+Pizza+Nagarbhavi/
        place_pattern = r'/maps/place/([^/@]+)'
        match = re.search(place_pattern, map_link)
        if match:
            place_name = unquote(match.group(1).replace('+', ' '))
            return {
                "latitude": None,
                "longitude": None,
                "needs_geocoding": True,
                "query": place_name
            }
        
        return None
        
    except Exception as e:
        print(f"Error extracting coordinates from {map_link}: {e}")
        return None


async def geocode_place_name(place_name: str, api_key: str = None) -> dict:
    """
    Convert place name to coordinates using Google Geocoding API.
    
    Returns: {"latitude": float, "longitude": float} or None
    """
    if not api_key:
        api_key = GOOGLE_GEOCODING_API_KEY
    
    if api_key == "YOUR_GOOGLE_API_KEY_HERE":
        print("⚠️ Google Geocoding API key not configured!")
        return None
    
    try:
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": place_name,
            "key": api_key
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()
        
        if data.get("status") == "OK" and data.get("results"):
            location = data["results"][0]["geometry"]["location"]
            return {
                "latitude": location["lat"],
                "longitude": location["lng"]
            }
        
        print(f"Geocoding failed for '{place_name}': {data.get('status')}")
        return None
        
    except Exception as e:
        print(f"Geocoding error for '{place_name}': {e}")
        return None


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in kilometers
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


# ======================================================
# CACHE FOR GEOCODED LOCATIONS (in-memory, simple)
# In production, store this in MongoDB for persistence
# ======================================================
geocode_cache = {}

# ======================================================
# ADD THIS FUNCTION HERE (move from bottom of file)
# ======================================================
async def expand_short_url(short_url: str) -> str:
    """Expand shortened Google Maps URLs (goo.gl, maps.app.goo.gl)"""
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            response = await client.get(short_url, timeout=10)
            expanded_url = str(response.url)
            print(f"📍 Expanded URL: {short_url} → {expanded_url}")
            return expanded_url
    except Exception as e:
        print(f"❌ Error expanding URL {short_url}: {e}")
        return short_url


async def get_coordinates_for_map_link(map_link: str, db=None) -> dict:
    """
    Get coordinates for a map link, using cache when possible.
    """
    if not map_link:
        return None
    
    # Check cache first
    if map_link in geocode_cache:
        print(f"📍 Cache hit for: {map_link}")
        return geocode_cache[map_link]

    # Expand short URLs first
    original_link = map_link
    if 'goo.gl' in map_link or 'maps.app' in map_link:
        map_link = await expand_short_url(map_link)
        print(f"📍 Expanded: {original_link} → {map_link}")
    
    # Extract/parse coordinates
    result = extract_coordinates_from_map_link(map_link)
    print(f"📍 Extracted result: {result}")
    
    if not result:
        return None
    
    # If needs geocoding, call the API
    if result.get("needs_geocoding") and result.get("query"):
        coords = await geocode_place_name(result["query"])
        if coords:
            result["latitude"] = coords["latitude"]
            result["longitude"] = coords["longitude"]
            result["needs_geocoding"] = False
    
    # Cache the result if we have coordinates
    if result.get("latitude") and result.get("longitude"):
        geocode_cache[map_link] = result
        return result
    
    return None


# ======================================================
# API ENDPOINTS
# ======================================================

@router.get("/pins")
async def get_map_pins(
    lat: float = Query(..., description="User's current latitude"),
    lng: float = Query(..., description="User's current longitude"),
    radius_km: float = Query(10, description="Search radius in kilometers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all map pins (restaurants + user posts + restaurant posts) within radius of user's location.
    """
    db = get_database()
    
    restaurants_pins = []
    posts_pins = []
    
    # ==================== RESTAURANTS ====================
    restaurants = await db.restaurants.find({
        "$or": [
            {"latitude": {"$exists": True, "$ne": None}},
            {"map_link": {"$exists": True, "$ne": None, "$ne": ""}}
        ]
    }).to_list(None)
    
    for restaurant in restaurants:
        # Use stored coordinates first, otherwise geocode
        if restaurant.get("latitude") and restaurant.get("longitude"):
            coords = {
                "latitude": restaurant["latitude"],
                "longitude": restaurant["longitude"]
            }
        else:
            coords = await get_coordinates_for_map_link(restaurant.get("map_link"))
            # Store coordinates for next time
            if coords and coords.get("latitude"):
                await db.restaurants.update_one(
                    {"_id": restaurant["_id"]},
                    {"$set": {"latitude": coords["latitude"], "longitude": coords["longitude"]}}
                )
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            distance = calculate_distance_km(lat, lng, coords["latitude"], coords["longitude"])
            
            if distance <= radius_km:
                review_count = await db.posts.count_documents({
                    "tagged_restaurant_id": str(restaurant["_id"])
                })
                
                restaurants_pins.append({
                    "id": str(restaurant["_id"]),
                    "type": "restaurant",
                    "name": restaurant.get("restaurant_name", "Unknown"),
                    "profile_picture": restaurant.get("profile_picture"),
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "review_count": review_count,
                    "distance_km": round(distance, 2),
                    "map_link": restaurant.get("map_link"),
                    "bio": restaurant.get("bio", ""),
                    "is_verified": restaurant.get("is_verified", False)
                })
    
    # ==================== USER POSTS ====================
    posts = await db.posts.find({
        "map_link": {"$exists": True, "$ne": None, "$ne": ""}
    }).to_list(None)
    
    for post in posts:
        # Use stored coordinates first, otherwise geocode
        if post.get("latitude") and post.get("longitude"):
            coords = {
                "latitude": post["latitude"],
                "longitude": post["longitude"]
            }
        else:
            coords = await get_coordinates_for_map_link(post.get("map_link"))
            # Store coordinates for next time
            if coords and coords.get("latitude"):
                await db.posts.update_one(
                    {"_id": post["_id"]},
                    {"$set": {"latitude": coords["latitude"], "longitude": coords["longitude"]}}
                )
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            distance = calculate_distance_km(lat, lng, coords["latitude"], coords["longitude"])
            
            if distance <= radius_km:
                user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
                posts_pins.append({
                    "id": str(post["_id"]),
                    "type": "post",
                    "user_id": post["user_id"],
                    "username": user.get("full_name", "Unknown") if user else "Unknown",
                    "user_profile_picture": user.get("profile_picture") if user else None,
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "distance_km": round(distance, 2),
                    "media_url": post.get("media_url") or post.get("image_url"),
                    "thumbnail_url": post.get("thumbnail_url"),
                    "media_type": post.get("media_type", "image"),
                    "rating": post.get("rating"),
                    "location_name": post.get("location_name"),
                    "category": post.get("category"),
                    "review_text": post.get("review_text", "")[:100],
                    "likes_count": post.get("likes_count", 0),
                    "map_link": post.get("map_link"),
                    "account_type": "user"
                })
    
    # ==================== RESTAURANT POSTS ====================
    restaurant_posts = await db.restaurant_posts.find({
        "map_link": {"$exists": True, "$ne": None, "$ne": ""}
    }).to_list(None)
    
    for post in restaurant_posts:
        # Use stored coordinates first, otherwise geocode
        if post.get("latitude") and post.get("longitude"):
            coords = {
                "latitude": post["latitude"],
                "longitude": post["longitude"]
            }
        else:
            coords = await get_coordinates_for_map_link(post.get("map_link"))
            # Store coordinates for next time
            if coords and coords.get("latitude"):
                await db.restaurant_posts.update_one(
                    {"_id": post["_id"]},
                    {"$set": {"latitude": coords["latitude"], "longitude": coords["longitude"]}}
                )
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            distance = calculate_distance_km(lat, lng, coords["latitude"], coords["longitude"])
            
            if distance <= radius_km:
                # Get restaurant info
                restaurant = await db.restaurants.find_one({"_id": ObjectId(post["restaurant_id"])})
                
                posts_pins.append({
                    "id": str(post["_id"]),
                    "type": "post",
                    "user_id": post["restaurant_id"],
                    "username": post.get("restaurant_name") or (restaurant.get("restaurant_name") if restaurant else "Unknown"),
                    "user_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "distance_km": round(distance, 2),
                    "media_url": post.get("media_url") or post.get("image_url"),
                    "thumbnail_url": post.get("thumbnail_url"),
                    "media_type": post.get("media_type", "image"),
                    "rating": None,  # Restaurant posts don't have rating
                    "location_name": post.get("location_name"),
                    "category": post.get("category"),
                    "review_text": post.get("about", "")[:100],  # Restaurant posts use "about" instead of "review_text"
                    "likes_count": post.get("likes_count", 0),
                    "map_link": post.get("map_link"),
                    "price": post.get("price"),  # Include price for restaurant posts
                    "account_type": "restaurant"
                })
    
    # Sort by distance (nearest first)
    restaurants_pins.sort(key=lambda x: x["distance_km"])
    posts_pins.sort(key=lambda x: x["distance_km"])
    
    return {
        "user_location": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "restaurants": restaurants_pins,
        "posts": posts_pins,
        "total_restaurants": len(restaurants_pins),
        "total_posts": len(posts_pins)
    }


@router.get("/search")
async def search_map_pins(
    q: str = Query(..., description="Search query (e.g., 'biryani', 'pizza')"),
    lat: float = Query(..., description="User's current latitude"),
    lng: float = Query(..., description="User's current longitude"),
    radius_km: float = Query(10, description="Search radius in kilometers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for posts on map by keyword (category, location_name, review_text).
    Only returns results within the specified radius.
    """
    db = get_database()
    
    if not q or not q.strip():
        return {"results": [], "query": q, "total": 0}
    
    query_text = q.strip()
    search_regex = {"$regex": query_text, "$options": "i"}
    
    # Search posts matching the query
    posts = await db.posts.find({
        "$and": [
            {"map_link": {"$exists": True, "$ne": None, "$ne": ""}},
            {"$or": [
                {"category": search_regex},
                {"location_name": search_regex},
                {"review_text": search_regex}
            ]}
        ]
    }).to_list(None)
    
    results = []
    
    for post in posts:
        coords = await get_coordinates_for_map_link(post.get("map_link"))
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            # Calculate distance from user
            distance = calculate_distance_km(
                lat, lng,
                coords["latitude"], coords["longitude"]
            )
            
            # Only include if within radius
            if distance <= radius_km:
                # Get user info
                user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
                
                # Check if current user liked this post
                is_liked = await db.likes.find_one({
                    "post_id": str(post["_id"]),
                    "user_id": str(current_user["_id"])
                }) is not None
                
                results.append({
                    "id": str(post["_id"]),
                    "type": "post",
                    "user_id": post["user_id"],
                    "username": user.get("full_name", "Unknown") if user else "Unknown",
                    "user_profile_picture": user.get("profile_picture") if user else None,
                    "user_level": user.get("level", 1) if user else 1,
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "distance_km": round(distance, 2),
                    "media_url": post.get("media_url") or post.get("image_url"),
                    "thumbnail_url": post.get("thumbnail_url"),
                    "media_type": post.get("media_type", "image"),
                    "rating": post.get("rating"),
                    "location_name": post.get("location_name"),
                    "category": post.get("category"),
                    "review_text": post.get("review_text", ""),
                    "likes_count": post.get("likes_count", 0),
                    "comments_count": post.get("comments_count", 0),
                    "is_liked_by_user": is_liked,
                    "map_link": post.get("map_link"),
                    "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", "")
                })
    
    # Sort by distance (nearest first)
    results.sort(key=lambda x: x["distance_km"])
    
    return {
        "query": query_text,
        "user_location": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "results": results,
        "total": len(results)
    }


@router.get("/restaurants/nearby")
async def get_nearby_restaurants(
    lat: float = Query(..., description="User's current latitude"),
    lng: float = Query(..., description="User's current longitude"),
    radius_km: float = Query(10, description="Search radius in kilometers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get only restaurants within radius, with review counts.
    """
    db = get_database()
    
    restaurants_pins = []
    
    restaurants = await db.restaurants.find({
        "map_link": {"$exists": True, "$ne": None, "$ne": ""}
    }).to_list(None)
    
    for restaurant in restaurants:
        coords = await get_coordinates_for_map_link(restaurant.get("map_link"))
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            distance = calculate_distance_km(
                lat, lng,
                coords["latitude"], coords["longitude"]
            )
            
            if distance <= radius_km:
                # Get review count
                review_count = await db.posts.count_documents({
                    "tagged_restaurant_id": str(restaurant["_id"])
                })
                
                # Get average rating from reviews
                reviews = await db.posts.find({
                    "tagged_restaurant_id": str(restaurant["_id"]),
                    "rating": {"$exists": True, "$ne": None}
                }).to_list(None)
                
                avg_rating = 0
                if reviews:
                    ratings = [r.get("rating", 0) for r in reviews if r.get("rating")]
                    avg_rating = sum(ratings) / len(ratings) if ratings else 0
                
                restaurants_pins.append({
                    "id": str(restaurant["_id"]),
                    "type": "restaurant",
                    "name": restaurant.get("restaurant_name", "Unknown"),
                    "profile_picture": restaurant.get("profile_picture"),
                    "cover_image": restaurant.get("cover_image"),
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "review_count": review_count,
                    "average_rating": round(avg_rating, 1),
                    "distance_km": round(distance, 2),
                    "map_link": restaurant.get("map_link"),
                    "bio": restaurant.get("bio", ""),
                    "is_verified": restaurant.get("is_verified", False)
                })
    
    restaurants_pins.sort(key=lambda x: x["distance_km"])
    
    return {
        "user_location": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "restaurants": restaurants_pins,
        "total": len(restaurants_pins)
    }


@router.get("/posts/nearby")
async def get_nearby_posts(
    lat: float = Query(..., description="User's current latitude"),
    lng: float = Query(..., description="User's current longitude"),
    radius_km: float = Query(10, description="Search radius in kilometers"),
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get only user posts within radius, optionally filtered by category.
    """
    db = get_database()
    
    # Build query
    query = {"map_link": {"$exists": True, "$ne": None, "$ne": ""}}
    
    if category:
        query["category"] = {"$regex": category, "$options": "i"}
    
    posts = await db.posts.find(query).to_list(None)
    
    posts_pins = []
    
    for post in posts:
        coords = await get_coordinates_for_map_link(post.get("map_link"))
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            distance = calculate_distance_km(
                lat, lng,
                coords["latitude"], coords["longitude"]
            )
            
            if distance <= radius_km:
                user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
                
                is_liked = await db.likes.find_one({
                    "post_id": str(post["_id"]),
                    "user_id": str(current_user["_id"])
                }) is not None
                
                posts_pins.append({
                    "id": str(post["_id"]),
                    "type": "post",
                    "user_id": post["user_id"],
                    "username": user.get("full_name", "Unknown") if user else "Unknown",
                    "user_profile_picture": user.get("profile_picture") if user else None,
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "distance_km": round(distance, 2),
                    "media_url": post.get("media_url") or post.get("image_url"),
                    "thumbnail_url": post.get("thumbnail_url"),
                    "media_type": post.get("media_type", "image"),
                    "rating": post.get("rating"),
                    "location_name": post.get("location_name"),
                    "category": post.get("category"),
                    "review_text": post.get("review_text", "")[:100],
                    "likes_count": post.get("likes_count", 0),
                    "is_liked_by_user": is_liked,
                    "map_link": post.get("map_link")
                })
    
    posts_pins.sort(key=lambda x: x["distance_km"])
    
    return {
        "user_location": {"latitude": lat, "longitude": lng},
        "radius_km": radius_km,
        "category_filter": category,
        "posts": posts_pins,
        "total": len(posts_pins)
    }


# ======================================================
# GEOCODING ENDPOINT (for manually caching coordinates)
# ======================================================

@router.post("/geocode-location")
async def geocode_and_cache_location(
    map_link: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually geocode a map_link and cache the result.
    Useful for pre-caching coordinates.
    """
    coords = await get_coordinates_for_map_link(map_link)
    
    if coords and coords.get("latitude") and coords.get("longitude"):
        return {
            "success": True,
            "map_link": map_link,
            "latitude": coords["latitude"],
            "longitude": coords["longitude"]
        }
    
    return {
        "success": False,
        "map_link": map_link,
        "error": "Could not extract or geocode coordinates"
    }


# ======================================================
# BATCH GEOCODING (for migrating existing data)
# ======================================================

@router.post("/batch-geocode")
async def batch_geocode_posts(
    limit: int = Query(100, description="Number of posts to process"),
    current_user: dict = Depends(get_current_user)
):
    """
    Batch geocode posts that have map_link but no stored coordinates.
    Run this once to cache coordinates for existing posts.
    
    Note: This will make multiple API calls, so be mindful of quotas.
    """
    db = get_database()
    
    # Get posts with map_link
    posts = await db.posts.find({
        "map_link": {"$exists": True, "$ne": None, "$ne": ""},
        "latitude": {"$exists": False}  # Only posts without coordinates
    }).limit(limit).to_list(limit)
    
    processed = 0
    success = 0
    failed = 0
    
    for post in posts:
        coords = await get_coordinates_for_map_link(post.get("map_link"))
        processed += 1
        
        if coords and coords.get("latitude") and coords.get("longitude"):
            # Store coordinates in post document
            await db.posts.update_one(
                {"_id": post["_id"]},
                {"$set": {
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                    "coordinates_updated_at": datetime.utcnow()
                }}
            )
            success += 1
        else:
            failed += 1
    
    return {
        "processed": processed,
        "success": success,
        "failed": failed,
        "message": f"Geocoded {success} out of {processed} posts"
    }
