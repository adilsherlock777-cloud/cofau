from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PostCreate(BaseModel):
    media_type: str  # "image" or "video"
    rating: float = Field(..., ge=0, le=10)
    review_text: str
    map_link: Optional[str] = None

class PostResponse(BaseModel):
    id: str
    user_id: str
    username: str
    user_profile_picture: Optional[str] = None
    user_badge: Optional[str] = None
    media_url: str
    media_type: str
    rating: float
    review_text: str
    map_link: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    popular_photos: List[str] = []
    created_at: datetime
