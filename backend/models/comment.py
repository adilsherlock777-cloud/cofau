from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class CommentCreate(BaseModel):
    comment_text: str

class CommentResponse(BaseModel):
    id: str
    post_id: str
    user_id: str
    username: str
    profile_pic: Optional[str] = None
    comment_text: str
    created_at: datetime
