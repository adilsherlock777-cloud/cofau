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
    Get nearby area/locality names by reverse-geocoding concentric rings
    of points around the user's location (up to 50km).
    """
    import asyncio

    try:
        db = get_database()
        cache_key = _cache_key(latitude, longitude, radius_km)

        # Check cache first (v4 = 50km concentric rings version)
        cached = await db.areas_cache.find_one({
            "cache_key": cache_key,
            "version": "v4",
            "expires_at": {"$gt": datetime.utcnow()},
        })
        if cached:
            areas = cached["areas"]
            for area in areas:
                if area.get("latitude") and area.get("longitude"):
                    area["distance_km"] = round(
                        _haversine(latitude, longitude, area["latitude"], area["longitude"]), 1
                    )
            areas.sort(key=lambda a: a.get("distance_km") or 9999)
            return {"success": True, "areas": areas, "cached": True}

        # Not cached — reverse-geocode concentric rings around the user
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"

        # 1 degree ≈ 111km, so 1km ≈ 0.009 degrees
        # Concentric rings: center, then rings at 2km, 5km, 10km, 20km, 35km, 50km
        # Inner rings (2-5km): 8 directions (N, NE, E, SE, S, SW, W, NW)
        # Outer rings (10-50km): 4 directions (N, E, S, W) to save API calls
        directions_8 = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
        directions_4 = [(1, 0), (0, 1), (-1, 0), (0, -1)]

        offsets_deg = [(0, 0)]  # center point
        ring_configs = [
            (0.018, directions_8),   # ~2km, 8 directions
            (0.045, directions_8),   # ~5km, 8 directions
            (0.09, directions_4),    # ~10km, 4 directions
            (0.18, directions_4),    # ~20km, 4 directions
            (0.315, directions_4),   # ~35km, 4 directions
            (0.45, directions_4),    # ~50km, 4 directions
        ]
        for km_deg, directions in ring_configs:
            for dlat_dir, dlng_dir in directions:
                offsets_deg.append((km_deg * dlat_dir, km_deg * dlng_dir))

        all_areas = []
        seen = set()
        target_types = {"sublocality_level_1", "sublocality", "neighborhood"}

        async def reverse_geocode_point(dlat, dlng):
            point_lat = latitude + dlat
            point_lng = longitude + dlng
            results = []
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get(geocode_url, params={
                        "latlng": f"{point_lat},{point_lng}",
                        "key": GOOGLE_MAPS_API_KEY,
                        "result_type": "sublocality|neighborhood",
                    }, timeout=10)
                    data = resp.json()
                if data.get("status") == "OK":
                    for result in data.get("results", []):
                        for component in result.get("address_components", []):
                            comp_types = set(component.get("types", []))
                            if comp_types & target_types:
                                name = component.get("long_name", "").strip()
                                if name:
                                    loc = result.get("geometry", {}).get("location", {})
                                    results.append({
                                        "name": name,
                                        "latitude": loc.get("lat"),
                                        "longitude": loc.get("lng"),
                                    })
            except Exception:
                pass
            return results

        # Run all reverse geocoding calls in parallel
        tasks = [reverse_geocode_point(dlat, dlng) for dlat, dlng in offsets_deg]
        results_list = await asyncio.gather(*tasks)

        for results in results_list:
            for area_info in results:
                name_lower = area_info["name"].lower()
                if name_lower in seen:
                    continue
                seen.add(name_lower)

                alat = area_info.get("latitude")
                alng = area_info.get("longitude")
                dist = round(_haversine(latitude, longitude, alat, alng), 1) if alat and alng else None

                if dist is not None and dist > radius_km:
                    continue

                all_areas.append({
                    "name": area_info["name"],
                    "latitude": alat,
                    "longitude": alng,
                    "distance_km": dist,
                })

        all_areas.sort(key=lambda a: a.get("distance_km") or 9999)

        # Store in cache
        await db.areas_cache.update_one(
            {"cache_key": cache_key},
            {"$set": {
                "cache_key": cache_key,
                "version": "v4",
                "areas": all_areas,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(hours=AREAS_CACHE_HOURS),
            }},
            upsert=True,
        )

        return {"success": True, "areas": all_areas, "cached": False}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch nearby areas: {str(e)}")


@router.get("/search-areas")
async def search_areas(
    query: str = Query(..., min_length=2, description="Area name to search"),
    latitude: float = Query(..., description="User latitude"),
    longitude: float = Query(..., description="User longitude"),
    current_user: dict = Depends(get_current_user),
):
    """
    Search for areas by name using Google Places Autocomplete,
    restricted to 50km radius from the user's location.
    """
    try:
        autocomplete_url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        async with httpx.AsyncClient() as client:
            resp = await client.get(autocomplete_url, params={
                "input": query,
                "location": f"{latitude},{longitude}",
                "radius": 50000,  # 50km in meters
                "strictbounds": "true",
                "types": "(regions)",
                "key": GOOGLE_MAPS_API_KEY,
            }, timeout=10)
            data = resp.json()

        if data.get("status") != "OK":
            return {"success": True, "areas": []}

        # For each prediction, get lat/lng via Place Details
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        areas = []

        for prediction in data.get("predictions", [])[:8]:
            place_id = prediction.get("place_id")
            name = prediction.get("structured_formatting", {}).get("main_text", "")
            if not place_id or not name:
                continue
            try:
                async with httpx.AsyncClient() as client:
                    det_resp = await client.get(details_url, params={
                        "place_id": place_id,
                        "fields": "geometry",
                        "key": GOOGLE_MAPS_API_KEY,
                    }, timeout=10)
                    det_data = det_resp.json()
                if det_data.get("status") == "OK":
                    loc = det_data["result"].get("geometry", {}).get("location", {})
                    alat = loc.get("lat")
                    alng = loc.get("lng")
                    if alat and alng:
                        dist = round(_haversine(latitude, longitude, alat, alng), 1)
                        if dist <= 50:
                            areas.append({
                                "name": name,
                                "latitude": alat,
                                "longitude": alng,
                                "distance_km": dist,
                            })
            except Exception:
                continue

        areas.sort(key=lambda a: a.get("distance_km") or 9999)
        return {"success": True, "areas": areas}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search areas: {str(e)}")


@router.get("/area-posts")
async def get_area_posts(
    area_name: str = Query(..., description="Area name to search for"),
    latitude: float = Query(..., description="Area centre latitude"),
    longitude: float = Query(..., description="Area centre longitude"),
    current_user: dict = Depends(get_current_user),
):
    """
    Get all posts that are inside a specific area.
    Uses Google Geocoding to get the area's exact viewport bounds,
    then returns only posts whose coordinates fall within those bounds.
    """
    try:
        db = get_database()

        # Step 1: Get the area's exact viewport bounds from Google Geocoding
        geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
        async with httpx.AsyncClient() as client:
            geo_resp = await client.get(geocode_url, params={
                "address": area_name,
                "location": f"{latitude},{longitude}",
                "key": GOOGLE_MAPS_API_KEY,
            })
            geo_data = geo_resp.json()

        # Extract viewport bounds (northeast and southwest corners)
        ne_lat = ne_lng = sw_lat = sw_lng = None
        if geo_data.get("status") == "OK" and geo_data.get("results"):
            geometry = geo_data["results"][0].get("geometry", {})
            viewport = geometry.get("viewport", {})
            ne = viewport.get("northeast", {})
            sw = viewport.get("southwest", {})
            ne_lat = ne.get("lat")
            ne_lng = ne.get("lng")
            sw_lat = sw.get("lat")
            sw_lng = sw.get("lng")

        # If we couldn't get viewport, fall back to a small radius
        if ne_lat is None or sw_lat is None:
            ne_lat = latitude + 0.015  # ~1.5km north
            ne_lng = longitude + 0.015
            sw_lat = latitude - 0.015
            sw_lng = longitude - 0.015

        # Step 2: Query posts within the bounding box
        all_posts = await db.posts.find({
            "latitude": {"$gte": sw_lat, "$lte": ne_lat},
            "longitude": {"$gte": sw_lng, "$lte": ne_lng},
        }).sort("created_at", -1).to_list(None)

        results = []
        for post in all_posts:
            media_url = post.get("media_url") or post.get("image_url")
            results.append({
                "id": str(post["_id"]),
                "media_url": media_url,
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "location_name": post.get("location_name"),
                "rating": post.get("rating"),
                "created_at": post.get("created_at").isoformat() if post.get("created_at") else None,
            })

        return {
            "success": True,
            "posts": results,
            "total": len(results),
            "bounds": {
                "northeast": {"lat": ne_lat, "lng": ne_lng},
                "southwest": {"lat": sw_lat, "lng": sw_lng},
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch area posts: {str(e)}")
