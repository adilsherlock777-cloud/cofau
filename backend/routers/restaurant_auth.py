from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime
from database import get_database
from models.restaurant import RestaurantCreate, RestaurantLogin, Token, RestaurantResponse, RestaurantUpdate
from utils.hashing import hash_password, verify_password
from utils.jwt import create_access_token, verify_token

router = APIRouter(prefix="/api/restaurant/auth", tags=["Restaurant Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/restaurant/auth/login")


async def get_current_restaurant(token: str = Depends(oauth2_scheme)):
    """Get current authenticated restaurant"""
    email = verify_token(token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    db = get_database()
    restaurant = await db.restaurants.find_one({"email": email})
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return restaurant


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
    
    # Validate restaurant name format (allow letters, numbers, spaces, and common punctuation)
    # More lenient than username since restaurant names can have spaces and special chars
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
    # Only checking in restaurants collection as per requirement
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
    
    # Create restaurant document (NO leveling system)
    restaurant_doc = {
        "restaurant_name": restaurant.restaurant_name.strip(),  # Store original casing
        "restaurant_name_normalized": name_normalized,  # Store normalized for searches
        "email": restaurant.email,
        "password_hash": hashed_password,
        "profile_picture": None,
        "cover_image": None,
        "bio": None,
        "phone": None,
        "phone_number": Optional[str] = None
        "phone_verified": bool = False
        "address": None,
        "cuisine_type": None,
        "posts_count": 0,
        "reviews_count": 0,
        "followers_count": 0,
        "following_count": 0,
        "is_verified": False,
        "account_type": "restaurant",  # Important: identifies this as restaurant account
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


@router.get("/check-name")
async def check_restaurant_name(name: str):
    """
    Check if restaurant name is available
    Returns: {"available": bool, "suggestions": []}
    """
    db = get_database()
    
    if not name or len(name.strip()) < 3:
        return {"available": False, "message": "Name must be at least 3 characters", "suggestions": []}
    
    name_normalized = name.strip().lower().replace("  ", " ")
    
    # Check if restaurant name exists (case-insensitive)
    existing_restaurant = await db.restaurants.find_one({
        "restaurant_name_normalized": name_normalized
    })
    
    if existing_restaurant:
        # Generate suggestions
        suggestions = []
        base_name = name.strip()
        
        # Try adding location-based suffixes or numbers
        suffixes = ["Cafe", "Kitchen", "Bistro", "House", "Place", "Spot"]
        
        # First try with common restaurant suffixes
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
        
        # If still need more, try with numbers
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
        "address": current_restaurant.get("address"),
        "cuisine_type": current_restaurant.get("cuisine_type"),
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
    
    # Handle restaurant name update (check uniqueness)
    if update_data.restaurant_name:
        name_normalized = update_data.restaurant_name.strip().lower().replace("  ", " ")
        
        # Check if new name is taken by another restaurant
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
    
    # Handle other fields
    if update_data.bio is not None:
        update_dict["bio"] = update_data.bio
    if update_data.phone is not None:
        update_dict["phone"] = update_data.phone
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
    
    # Fetch updated document
    updated_restaurant = await db.restaurants.find_one({"_id": current_restaurant["_id"]})
    
    return {
        "id": str(updated_restaurant["_id"]),
        "restaurant_name": updated_restaurant["restaurant_name"],
        "email": updated_restaurant["email"],
        "profile_picture": updated_restaurant.get("profile_picture"),
        "cover_image": updated_restaurant.get("cover_image"),
        "bio": updated_restaurant.get("bio"),
        "phone": updated_restaurant.get("phone"),
        "address": updated_restaurant.get("address"),
        "cuisine_type": updated_restaurant.get("cuisine_type"),
        "posts_count": updated_restaurant.get("posts_count", 0),
        "reviews_count": updated_restaurant.get("reviews_count", 0),
        "followers_count": updated_restaurant.get("followers_count", 0),
        "is_verified": updated_restaurant.get("is_verified", False),
        "created_at": updated_restaurant["created_at"]
    }


# NOTE: OTP/Forgot password functionality can be added later if needed
# For now, restaurants use simple email + password authentication