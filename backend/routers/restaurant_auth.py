from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime
from pydantic import EmailStr
from typing import Optional, Literal
from uuid import uuid4
import os
import shutil
from database import get_database
from models.restaurant import RestaurantCreate, RestaurantLogin, Token, RestaurantResponse, RestaurantUpdate
from utils.hashing import hash_password, verify_password
from routers.map import get_coordinates_for_map_link
from utils.jwt import create_access_token, verify_token
from config import settings

router = APIRouter(prefix="/api/restaurant/auth", tags=["Restaurant Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/restaurant/auth/login")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.isabs(settings.UPLOAD_DIR):
    UPLOAD_DIR = os.path.join(BASE_DIR, settings.UPLOAD_DIR)
else:
    UPLOAD_DIR = settings.UPLOAD_DIR


async def get_current_restaurant(token: str = Depends(oauth2_scheme)):
    """Get current authenticated restaurant"""
    try:
        print(f"🔐 Authenticating restaurant with token...")
        print(f"   Token preview: {token[:50]}..." if len(token) > 50 else f"   Token: {token}")

        email = verify_token(token)
        print(f"   Email from token: {email}")

        if email is None:
            print(f"   ❌ Token verification failed - email is None")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials - token verification returned None",
                headers={"WWW-Authenticate": "Bearer"},
            )

        db = get_database()
        restaurant = await db.restaurants.find_one({"email": email})

        if restaurant is None:
            print(f"   ❌ Restaurant not found in database for email: {email}")
            # Debug: List all restaurant emails in database
            all_restaurants = await db.restaurants.find().to_list(None)
            print(f"   📋 All restaurants in DB ({len(all_restaurants)} total):")
            for r in all_restaurants:
                print(f"      - {r.get('email')} (ID: {r.get('_id')})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Restaurant account not found for email: {email}",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print(f"   ✅ Restaurant authenticated: {restaurant.get('restaurant_name')} (ID: {restaurant.get('_id')})")
        return restaurant
    except HTTPException:
        raise
    except Exception as e:
        print(f"   ❌ Unexpected error in get_current_restaurant: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/signup", response_model=Token)
async def restaurant_signup(restaurant: RestaurantCreate):
    """Register a new restaurant"""
    db = get_database()
    
    # Check if passwords match
    if restaurant.password != restaurant.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )
    
    # Normalize restaurant name (lowercase, remove extra spaces)
    name_normalized = restaurant.restaurant_name.strip().lower().replace("  ", " ")
    
    # Validate restaurant name format
    if len(name_normalized) < 3:
        raise HTTPException(
            status_code=400,
            detail="Restaurant name must be at least 3 characters"
        )
    
    if len(name_normalized) > 50:
        raise HTTPException(
            status_code=400,
            detail="Restaurant name must be less than 50 characters"
        )
    
    # Check if email already exists in restaurants collection
    existing_email = await db.restaurants.find_one({"email": restaurant.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if restaurant name already exists (case-insensitive)
    existing_name = await db.restaurants.find_one({
        "restaurant_name_normalized": name_normalized
    })
    if existing_name:
        raise HTTPException(
            status_code=400,
            detail=f"Restaurant name '{restaurant.restaurant_name}' is already taken"
        )
    
    # Hash password
    hashed_password = hash_password(restaurant.password)

    # Get coordinates - Priority: direct coordinates > map_link extraction
    latitude = None
    longitude = None
    map_link = None

    # First, check if coordinates are provided directly (from map picker)
    if hasattr(restaurant, 'latitude') and restaurant.latitude:
        latitude = restaurant.latitude
    if hasattr(restaurant, 'longitude') and restaurant.longitude:
        longitude = restaurant.longitude

    # If no direct coordinates, try to extract from map_link
    if not latitude or not longitude:
        if hasattr(restaurant, 'map_link') and restaurant.map_link:
            map_link = restaurant.map_link.strip()
            try:
                coords = await get_coordinates_for_map_link(map_link)
                if coords:
                    latitude = coords.get("latitude")
                    longitude = coords.get("longitude")
            except Exception as e:
                print(f"Error extracting coordinates: {e}")

    print(f"📍 Restaurant signup - Coordinates: {latitude}, {longitude}")

    # Create restaurant document
    restaurant_doc = {
        "restaurant_name": restaurant.restaurant_name.strip(),
        "restaurant_name_normalized": name_normalized,
        "email": restaurant.email,
        "password_hash": hashed_password,
        "profile_picture": None,
        "cover_image": None,
        "bio": None,
        "phone": None,
        "phone_number": restaurant.phone_number if hasattr(restaurant, 'phone_number') else None,
        "phone_verified": restaurant.phone_verified if hasattr(restaurant, 'phone_verified') else False,
        "address": None,
        "cuisine_type": None,
        "food_type": restaurant.food_type,  # veg, non_veg, or veg_and_non_veg
        "fssai_license_number": restaurant.fssai_license_number,  # mandatory 14-digit FSSAI number
        "gst_number": restaurant.gst_number,  # optional GST number
        "map_link": map_link,
        "latitude": latitude,
        "longitude": longitude,
        "posts_count": 0,
        "reviews_count": 0,
        "followers_count": 0,
        "following_count": 0,
        "is_verified": False,
        "account_type": "restaurant",
        "created_at": datetime.utcnow()
    }
    
    # Insert restaurant
    result = await db.restaurants.insert_one(restaurant_doc)
    
    # Create access token with restaurant identifier
    access_token = create_access_token(data={
        "sub": restaurant.email,
        "account_type": "restaurant"
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "account_type": "restaurant"
    }


@router.post("/signup-with-fssai", response_model=Token)
async def restaurant_signup_with_fssai(
    restaurant_name: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    food_type: Literal['veg', 'non_veg', 'veg_and_non_veg'] = Form(...),
    fssai_license_number: str = Form(...),
    fssai_license_file: UploadFile = File(...),
    gst_number: Optional[str] = Form(None),
    map_link: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    phone_number: Optional[str] = Form(None),
    phone_verified: Optional[bool] = Form(False),
):
    """Register a new restaurant with mandatory FSSAI document upload"""
    db = get_database()

    if password != confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match"
        )

    name_normalized = restaurant_name.strip().lower().replace("  ", " ")

    if len(name_normalized) < 3:
        raise HTTPException(
            status_code=400,
            detail="Restaurant name must be at least 3 characters"
        )

    if len(name_normalized) > 50:
        raise HTTPException(
            status_code=400,
            detail="Restaurant name must be less than 50 characters"
        )

    if not fssai_license_number or len(fssai_license_number.strip()) != 14:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid 14-digit FSSAI License Number"
        )

    existing_email = await db.restaurants.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_name = await db.restaurants.find_one({
        "restaurant_name_normalized": name_normalized
    })
    if existing_name:
        raise HTTPException(
            status_code=400,
            detail=f"Restaurant name '{restaurant_name}' is already taken"
        )

    allowed_types = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "application/pdf": ".pdf",
    }
    content_type = (fssai_license_file.content_type or "").lower()
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="FSSAI document must be a PNG, JPG, or PDF file"
        )

    ext = os.path.splitext(fssai_license_file.filename or "")[1].lower()
    if not ext:
        ext = allowed_types[content_type]

    upload_dir = os.path.join(UPLOAD_DIR, "restaurants", "fssai")
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"fssai_{uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(fssai_license_file.file, buffer)

    fssai_license_url = f"/api/static/uploads/restaurants/fssai/{filename}"

    hashed_password = hash_password(password)

    coords_lat = latitude
    coords_long = longitude
    map_link_value = map_link.strip() if map_link else None

    if not coords_lat or not coords_long:
        if map_link_value:
            try:
                coords = await get_coordinates_for_map_link(map_link_value)
                if coords:
                    coords_lat = coords.get("latitude")
                    coords_long = coords.get("longitude")
            except Exception as e:
                print(f"Error extracting coordinates: {e}")

    restaurant_doc = {
        "restaurant_name": restaurant_name.strip(),
        "restaurant_name_normalized": name_normalized,
        "email": email,
        "password_hash": hashed_password,
        "profile_picture": None,
        "cover_image": None,
        "bio": None,
        "phone": None,
        "phone_number": phone_number,
        "phone_verified": phone_verified,
        "address": None,
        "cuisine_type": None,
        "food_type": food_type,
        "fssai_license_number": fssai_license_number.strip(),
        "fssai_license_document": fssai_license_url,
        "gst_number": gst_number,
        "map_link": map_link_value,
        "latitude": coords_lat,
        "longitude": coords_long,
        "posts_count": 0,
        "reviews_count": 0,
        "followers_count": 0,
        "following_count": 0,
        "is_verified": False,
        "account_type": "restaurant",
        "created_at": datetime.utcnow()
    }

    await db.restaurants.insert_one(restaurant_doc)

    access_token = create_access_token(data={
        "sub": email,
        "account_type": "restaurant"
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "account_type": "restaurant"
    }


@router.post("/login", response_model=Token)
async def restaurant_login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login restaurant"""
    db = get_database()
    
    # Find restaurant by email
    restaurant = await db.restaurants.find_one({"email": form_data.username})
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(form_data.password, restaurant["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token = create_access_token(data={
        "sub": restaurant["email"],
        "account_type": "restaurant"
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "account_type": "restaurant"
    }

from pydantic import BaseModel

class PhoneLoginRequest(BaseModel):
    phone_number: str

@router.post("/login-phone")
async def restaurant_login_with_phone(request: PhoneLoginRequest):
    """Login restaurant with verified phone number (after Firebase OTP verification)"""
    db = get_database()

    # Find restaurant by phone number
    restaurant = await db.restaurants.find_one({"phone_number": request.phone_number})

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No restaurant account found with this phone number. Please sign up first."
        )

    # Check if phone is verified
    if not restaurant.get("phone_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phone number is not verified. Please verify during signup."
        )

    # Create access token using the restaurant's email
    access_token = create_access_token(data={
        "sub": restaurant["email"],
        "account_type": "restaurant"
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "account_type": "restaurant"
    }


class UpdatePhoneRequest(BaseModel):
    phone_number: str
    phone_verified: bool = False


@router.put("/update-phone")
async def update_restaurant_phone(
    request: UpdatePhoneRequest,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Update restaurant phone number"""
    db = get_database()

    await db.restaurants.update_one(
        {"_id": current_restaurant["_id"]},
        {"$set": {
            "phone_number": request.phone_number,
            "phone_verified": request.phone_verified
        }}
    )

    return {"message": "Phone number updated successfully"}


@router.get("/check-name")
async def check_restaurant_name(name: str):
    """Check if restaurant name is available"""
    db = get_database()
    
    if not name or len(name.strip()) < 3:
        return {"available": False, "message": "Name must be at least 3 characters", "suggestions": []}
    
    name_normalized = name.strip().lower().replace("  ", " ")
    
    existing_restaurant = await db.restaurants.find_one({
        "restaurant_name_normalized": name_normalized
    })
    
    if existing_restaurant:
        suggestions = []
        base_name = name.strip()
        suffixes = ["Cafe", "Kitchen", "Bistro", "House", "Place", "Spot"]
        
        for suffix in suffixes:
            suggested = f"{base_name} {suffix}"
            suggested_normalized = suggested.lower().replace("  ", " ")
            check_restaurant = await db.restaurants.find_one({
                "restaurant_name_normalized": suggested_normalized
            })
            if not check_restaurant:
                suggestions.append(suggested)
                if len(suggestions) >= 3:
                    break
        
        if len(suggestions) < 5:
            for i in range(1, 100):
                suggested = f"{base_name} {i}"
                suggested_normalized = suggested.lower()
                check_restaurant = await db.restaurants.find_one({
                    "restaurant_name_normalized": suggested_normalized
                })
                if not check_restaurant:
                    suggestions.append(suggested)
                    if len(suggestions) >= 5:
                        break
        
        return {
            "available": False,
            "message": f"Restaurant name '{name}' is already taken",
            "suggestions": suggestions
        }
    
    return {"available": True, "message": "Name is available", "suggestions": []}


@router.get("/me", response_model=RestaurantResponse)
async def get_restaurant_profile(current_restaurant: dict = Depends(get_current_restaurant)):
    """Get current restaurant profile"""
    return {
        "id": str(current_restaurant["_id"]),
        "restaurant_name": current_restaurant["restaurant_name"],
        "email": current_restaurant["email"],
        "profile_picture": current_restaurant.get("profile_picture"),
        "cover_image": current_restaurant.get("cover_image"),
        "bio": current_restaurant.get("bio"),
        "phone": current_restaurant.get("phone"),
        "phone_number": current_restaurant.get("phone_number"),  # Include phone_number field
        "address": current_restaurant.get("address"),
        "cuisine_type": current_restaurant.get("cuisine_type"),
        "food_type": current_restaurant.get("food_type"),  # veg, non_veg, or veg_and_non_veg
        "posts_count": current_restaurant.get("posts_count", 0),
        "reviews_count": current_restaurant.get("reviews_count", 0),
        "followers_count": current_restaurant.get("followers_count", 0),
        "is_verified": current_restaurant.get("is_verified", False),
        "created_at": current_restaurant["created_at"]
    }


@router.put("/update", response_model=RestaurantResponse)
async def update_restaurant_profile(
    update_data: RestaurantUpdate,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Update restaurant profile"""
    db = get_database()
    
    update_dict = {}
    
    if update_data.restaurant_name:
        name_normalized = update_data.restaurant_name.strip().lower().replace("  ", " ")
        
        existing = await db.restaurants.find_one({
            "restaurant_name_normalized": name_normalized,
            "_id": {"$ne": current_restaurant["_id"]}
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Restaurant name '{update_data.restaurant_name}' is already taken"
            )
        
        update_dict["restaurant_name"] = update_data.restaurant_name.strip()
        update_dict["restaurant_name_normalized"] = name_normalized
    
    if update_data.bio is not None:
        update_dict["bio"] = update_data.bio
    if update_data.phone is not None:
        update_dict["phone"] = update_data.phone
        # Also update phone_number field for consistency
        update_dict["phone_number"] = update_data.phone
        print(f"📞 Restaurant phone updated: {update_data.phone}")
    if update_data.address is not None:
        update_dict["address"] = update_data.address
    if update_data.cuisine_type is not None:
        update_dict["cuisine_type"] = update_data.cuisine_type
    
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        await db.restaurants.update_one(
            {"_id": current_restaurant["_id"]},
            {"$set": update_dict}
        )
    
    updated_restaurant = await db.restaurants.find_one({"_id": current_restaurant["_id"]})

    return {
        "id": str(updated_restaurant["_id"]),
        "restaurant_name": updated_restaurant["restaurant_name"],
        "email": updated_restaurant["email"],
        "profile_picture": updated_restaurant.get("profile_picture"),
        "cover_image": updated_restaurant.get("cover_image"),
        "bio": updated_restaurant.get("bio"),
        "phone": updated_restaurant.get("phone"),
        "phone_number": updated_restaurant.get("phone_number"),  # Include phone_number field
        "address": updated_restaurant.get("address"),
        "cuisine_type": updated_restaurant.get("cuisine_type"),
        "food_type": updated_restaurant.get("food_type"),  # veg, non_veg, or veg_and_non_veg
        "posts_count": updated_restaurant.get("posts_count", 0),
        "reviews_count": updated_restaurant.get("reviews_count", 0),
        "followers_count": updated_restaurant.get("followers_count", 0),
        "is_verified": updated_restaurant.get("is_verified", False),
        "created_at": updated_restaurant["created_at"]
    }
