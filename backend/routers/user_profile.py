from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_database
from routers.auth import get_current_user
from bson import ObjectId

router = APIRouter(prefix="/api/user", tags=["User Profile"])


class AddressCreate(BaseModel):
    latitude: float
    longitude: float
    address: str
    house_number: str
    street_address: str
    pincode: str


class AddressResponse(BaseModel):
    latitude: float
    longitude: float
    address: str
    house_number: str
    street_address: str
    pincode: str


@router.post("/address", response_model=AddressResponse)
async def save_user_address(
    address_data: AddressCreate,
    current_user: dict = Depends(get_current_user)
):
    """Save or update user's delivery address"""
    db = get_database()

    # Validate pincode
    if len(address_data.pincode) != 6 or not address_data.pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid pincode. Must be 6 digits.")

    # Update user document with address
    address_doc = {
        "latitude": address_data.latitude,
        "longitude": address_data.longitude,
        "address": address_data.address,
        "house_number": address_data.house_number,
        "street_address": address_data.street_address,
        "pincode": address_data.pincode,
    }

    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"delivery_address": address_doc}}
    )

    return address_doc


@router.get("/address", response_model=AddressResponse)
async def get_user_address(current_user: dict = Depends(get_current_user)):
    """Get user's saved delivery address"""
    db = get_database()

    user = await db.users.find_one({"_id": ObjectId(current_user["_id"])})

    if not user or "delivery_address" not in user:
        raise HTTPException(status_code=404, detail="No address found")

    return user["delivery_address"]


@router.delete("/address")
async def delete_user_address(current_user: dict = Depends(get_current_user)):
    """Delete user's delivery address"""
    db = get_database()

    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$unset": {"delivery_address": ""}}
    )

    return {"message": "Address deleted successfully"}
