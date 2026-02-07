from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


class RestaurantCreate(BaseModel):
    """Schema for restaurant registration"""
    restaurant_name: str = Field(..., min_length=3, max_length=100, description="Restaurant legal name")
    email: EmailStr
    password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)
    food_type: Literal['veg', 'non_veg', 'veg_and_non_veg'] = Field(..., description="Restaurant food type: veg, non_veg, or veg_and_non_veg")
    fssai_license_number: str = Field(..., min_length=14, max_length=14, description="14-digit FSSAI License Number (mandatory)")
    gst_number: Optional[str] = Field(None, description="GST Number (optional)")
    map_link: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone_number: Optional[str] = None
    phone_verified: Optional[bool] = False

    class Config:
        json_schema_extra = {
            "example": {
                "restaurant_name": "Pizza Palace Pvt Ltd",
                "email": "contact@pizzapalace.com",
                "password": "securepassword123",
                "confirm_password": "securepassword123",
                "food_type": "veg_and_non_veg",
                "fssai_license_number": "12345678901234",
                "gst_number": "22AAAAA0000A1Z5"
            }
        }


class RestaurantLogin(BaseModel):
    """Schema for restaurant login"""
    email: EmailStr
    password: str


class RestaurantResponse(BaseModel):
    """Schema for restaurant response (public data)"""
    id: str
    restaurant_name: str
    email: str
    profile_picture: Optional[str] = None
    cover_image: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    phone_number: Optional[str] = None  # Added for consistency with partner dashboard checks
    address: Optional[str] = None
    cuisine_type: Optional[str] = None
    food_type: Optional[str] = None  # veg, non_veg, or veg_and_non_veg
    posts_count: int = 0
    reviews_count: int = 0
    followers_count: int = 0
    is_verified: bool = False
    created_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "restaurant_name": "Pizza Palace",
                "email": "contact@pizzapalace.com",
                "profile_picture": None,
                "cover_image": None,
                "bio": "Best pizza in town!",
                "phone": "+1234567890",
                "address": "123 Food Street",
                "cuisine_type": "Italian",
                "food_type": "veg_and_non_veg",
                "posts_count": 0,
                "reviews_count": 0,
                "followers_count": 0,
                "is_verified": False,
                "created_at": "2024-01-01T00:00:00"
            }
        }


class RestaurantUpdate(BaseModel):
    """Schema for updating restaurant profile"""
    restaurant_name: Optional[str] = Field(None, min_length=3, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = None
    address: Optional[str] = None
    cuisine_type: Optional[str] = None


class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str
    account_type: str = "restaurant"  # To differentiate from user tokens