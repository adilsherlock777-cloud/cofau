from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ModerationResult(BaseModel):
    """Moderation result from Sightengine API"""
    is_safe: bool
    moderation_score: float  # Overall safety score (0-1, higher is safer)
    nudity_score: float = 0.0
    alcohol_score: float = 0.0
    offensive_score: float = 0.0
    weapons_score: float = 0.0
    drugs_score: float = 0.0
    raw_response: Optional[Dict[str, Any]] = None
    moderated_at: datetime
    file_path: str
    user_id: Optional[str] = None

class ModerationResponse(BaseModel):
    """Response model for moderation check"""
    allowed: bool
    reason: Optional[str] = None
    moderation_result: Optional[ModerationResult] = None

