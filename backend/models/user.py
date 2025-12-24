from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from bson import ObjectId

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")

class UserCreate(BaseModel):
    full_name: str
    username: str = Field(..., min_length=3, max_length=30, description="Unique username (3-30 characters)")
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    full_name: str
    username: Optional[str] = None
    email: str
    profile_picture: Optional[str] = None
    bio: Optional[str] = None
    points: int = 0
    level: int = 1
    currentPoints: int = 0
    requiredPoints: int = 1250
    title: str = "Reviewer"
    badge: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    created_at: datetime

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
