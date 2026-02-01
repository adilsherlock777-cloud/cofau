from fastapi import APIRouter, Depends, HTTPException, Query
import httpx
from routers.auth import get_current_user

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
