from fastapi import APIRouter, Depends, HTTPException, Query
import httpx
from math import radians, cos, sin, asin, sqrt
from datetime import datetime, timedelta
from routers.auth import get_current_user
from database import get_database

router = APIRouter(prefix="/api/places", tags=["Google Places"])

# Google Maps API Key from map.py
GOOGLE_MAPS_API_KEY = "AIzaSyDLBWLLuXT7hMU2LySIervGx6b2iZwWqyE"

@router.get("/nearby")
async def get_nearby_places(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    radius: int = Query(50, description="Search radius in meters"),
    type: str = Query("restaurant", description="Place type"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get nearby places using Google Places API (Nearby Search).
    Returns restaurants near the given coordinates.
    """
    try:
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{latitude},{longitude}",
            "radius": radius,
            "type": type,
            "key": GOOGLE_MAPS_API_KEY
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()

        if data.get("status") == "OK":
            return {
                "success": True,
                "results": data.get("results", []),
                "status": data.get("status")
            }
        else:
            return {
                "success": False,
                "results": [],
                "status": data.get("status"),
                "error_message": data.get("error_message", "No results found")
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch places: {str(e)}")


@router.get("/details")
async def get_place_details(
    place_id: str = Query(..., description="Google Place ID"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get detailed information about a place using Google Places API (Place Details).
    """
    try:
        url = "https://maps.googleapis.com/maps/api/place/details/json"
        params = {
            "place_id": place_id,
            "key": GOOGLE_MAPS_API_KEY,
            "fields": "name,rating,user_ratings_total,formatted_address,formatted_phone_number,opening_hours,website,photos"
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            data = response.json()

        if data.get("status") == "OK":
            return {
                "success": True,
                "result": data.get("result", {}),
                "status": data.get("status")
            }
        else:
            return {
                "success": False,
                "result": {},
                "status": data.get("status"),
                "error_message": data.get("error_message", "Place not found")
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch place details: {str(e)}")


def _haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two points in km."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


AREAS_CACHE_HOURS = 24  # Cache nearby areas for 24 hours


def _cache_key(lat: float, lng: float, radius_km: int) -> str:
    """Round coordinates to ~1km grid so nearby requests share the same cache."""
    return f"{round(lat, 2)}_{round(lng, 2)}_{radius_km}"


@router.get("/nearby-areas")
async def get_nearby_areas(
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    radius_km: int = Query(50, description="Search radius in km"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get nearby area / locality names using Google Places Nearby Search.
    Results are cached in MongoDB for 24 hours to avoid repeated API charges.
    """
    try:
        db = get_database()
        cache_key = _cache_key(latitude, longitude, radius_km)

        # Check cache first (only use cache if it has > 5 areas, otherwise re-fetch)
        cached = await db.areas_cache.find_one({
            "cache_key": cache_key,
            "expires_at": {"$gt": datetime.utcnow()},
        })
        if cached and len(cached.get("areas", [])) > 5:
            # Recalculate distances from the user's exact position
            areas = cached["areas"]
            for area in areas:
                if area.get("latitude") and area.get("longitude"):
                    area["distance_km"] = round(
                        _haversine(latitude, longitude, area["latitude"], area["longitude"]), 1
                    )
            areas.sort(key=lambda a: a.get("distance_km") or 9999)
            return {"success": True, "areas": areas, "cached": True}

        # Not cached — use Google Places Text Search API
        # Text Search returns many more results for Indian areas than Nearby Search
        text_search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

        all_areas = []
        seen = set()

        # First, reverse-geocode to get the city name for better search queries
        city_name = ""
        try:
            geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
            async with httpx.AsyncClient() as client:
                geo_resp = await client.get(geocode_url, params={
                    "latlng": f"{latitude},{longitude}",
                    "key": GOOGLE_MAPS_API_KEY,
                    "result_type": "locality",
                })
                geo_data = geo_resp.json()
            if geo_data.get("status") == "OK" and geo_data.get("results"):
                for component in geo_data["results"][0].get("address_components", []):
                    if "locality" in component.get("types", []):
                        city_name = component.get("long_name", "")
                        break
        except Exception:
            pass

        # Search queries that return area/locality names for Indian cities
        search_queries = [
            f"areas in {city_name}" if city_name else "areas nearby",
            f"localities in {city_name}" if city_name else "localities nearby",
            f"neighbourhoods in {city_name}" if city_name else "neighbourhoods nearby",
        ]

        for query in search_queries:
            params = {
                "query": query,
                "location": f"{latitude},{longitude}",
                "radius": radius_km * 1000,
                "key": GOOGLE_MAPS_API_KEY,
            }
            async with httpx.AsyncClient() as client:
                resp = await client.get(text_search_url, params=params)
                data = resp.json()

            if data.get("status") == "OK":
                for place in data.get("results", []):
                    name = place.get("name", "").strip()
                    if not name or name.lower() in seen:
                        continue

                    # Filter out non-area results (businesses, restaurants, etc.)
                    place_types = place.get("types", [])
                    area_types = {
                        "sublocality", "sublocality_level_1", "sublocality_level_2",
                        "neighborhood", "locality", "political",
                        "administrative_area_level_3", "administrative_area_level_4",
                    }
                    if not any(t in area_types for t in place_types):
                        continue

                    seen.add(name.lower())

                    loc = place.get("geometry", {}).get("location", {})
                    plat = loc.get("lat")
                    plng = loc.get("lng")
                    dist = round(_haversine(latitude, longitude, plat, plng), 1) if plat and plng else None

                    # Skip if outside the requested radius
                    if dist is not None and dist > radius_km:
                        continue

                    all_areas.append({
                        "name": name,
                        "latitude": plat,
                        "longitude": plng,
                        "distance_km": dist,
                    })

        all_areas.sort(key=lambda a: a.get("distance_km") or 9999)

        # Store in cache (upsert so we don't duplicate)
        await db.areas_cache.update_one(
            {"cache_key": cache_key},
            {"$set": {
                "cache_key": cache_key,
                "areas": all_areas,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=AREAS_CACHE_HOURS),
            }},
            upsert=True,
        )

        return {"success": True, "areas": all_areas, "cached": False}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch nearby areas: {str(e)}")


@router.get("/area-posts")
async def get_area_posts(
    latitude: float = Query(..., description="Area centre latitude"),
    longitude: float = Query(..., description="Area centre longitude"),
    radius_km: float = Query(5, description="Radius around the area centre in km"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all posts within a given radius of an area's coordinates.
    Returns posts sorted from latest to oldest.
    """
    try:
        db = get_database()

        all_posts = await db.posts.find({
            "latitude": {"$exists": True, "$ne": None},
            "longitude": {"$exists": True, "$ne": None},
        }).sort("created_at", -1).to_list(None)

        results = []
        for post in all_posts:
            plat = post.get("latitude")
            plng = post.get("longitude")
            if plat is None or plng is None:
                continue
            dist = _haversine(latitude, longitude, plat, plng)
            if dist > radius_km:
                continue

            media_url = post.get("media_url") or post.get("image_url")
            results.append({
                "id": str(post["_id"]),
                "media_url": media_url,
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "location_name": post.get("location_name"),
                "rating": post.get("rating"),
                "created_at": post.get("created_at").isoformat() if post.get("created_at") else None,
                "distance_km": round(dist, 2),
            })

        return {"success": True, "posts": results, "total": len(results)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch area posts: {str(e)}")
