from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class RestaurantCreate(BaseModel):
    """Schema for restaurant registration"""
    restaurant_name: str = Field(..., min_length=3, max_length=50, description="Restaurant name (acts as username)")
    email: EmailStr
    password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)
    map_link: Optional[str] = None 
    
    class Config:
        json_schema_extra = {
            "example": {
                "restaurant_name": "Pizza Palace",
                "email": "contact@pizzapalace.com",
                "password": "securepassword123",
                "confirm_password": "securepassword123"
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
    address: Optional[str] = None
    cuisine_type: Optional[str] = None
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