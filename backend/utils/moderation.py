"""
Content Moderation Service using Sightengine API
Blocks nudity, alcohol, weapons, drugs, and offensive content
"""
import requests
import os
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import HTTPException
from config import settings

# Import models with relative path handling
try:
    from models.moderation import ModerationResult, ModerationResponse
except ImportError:
    # Fallback for different import contexts
    import sys
    import os
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    from models.moderation import ModerationResult, ModerationResponse

SIGHTENGINE_API_URL = "https://api.sightengine.com/1.0/check.json"

# Thresholds for blocking content (0.0 to 1.0, higher = more likely to be that content)
# STRICT THRESHOLDS: Lower values = more strict blocking
BLOCK_THRESHOLDS = {
    "nudity": 0.2,  # Block if nudity probability > 20% (STRICT - no nudity allowed)
    "alcohol": 0.3,  # Block if alcohol probability > 30% (STRICT - no alcohol allowed)
    "weapons": 0.3,  # Block if weapons probability > 30%
    "drugs": 0.3,  # Block if drugs probability > 30%
    "offensive": 0.5,  # Block if offensive probability > 50%
}

def check_image_moderation(file_path: str, user_id: Optional[str] = None) -> ModerationResponse:
    """
    Check image content using Sightengine API
    
    Args:
        file_path: Path to the uploaded image file
        user_id: Optional user ID for tracking
        
    Returns:
        ModerationResponse with allowed status and moderation details
    """
    try:
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="File not found for moderation")
        
        # Prepare API request
        with open(file_path, 'rb') as image_file:
            files = {'media': image_file}
            params = {
                'api_user': settings.SIGHTENGINE_API_USER,
                'api_secret': settings.SIGHTENGINE_API_SECRET,
                'models': 'nudity-2.0,wad,offensive,scam,celebrities,face-attributes',
            }
            
            response = requests.post(SIGHTENGINE_API_URL, files=files, params=params, timeout=30)
            response.raise_for_status()
            result = response.json()
        
        # Extract scores from response
        nudity_score = result.get('nudity', {}).get('sexual_activity', 0.0) + \
                      result.get('nudity', {}).get('sexual_display', 0.0) + \
                      result.get('nudity', {}).get('erotica', 0.0)
        
        alcohol_score = result.get('alcohol', 0.0)
        weapons_score = result.get('weapons', 0.0)
        drugs_score = result.get('drugs', 0.0)
        offensive_score = result.get('offensive', {}).get('prob', 0.0)
        
        # Calculate overall moderation score (inverse - higher is safer)
        # Take the maximum of all category scores as the risk level
        max_risk = max(nudity_score, alcohol_score, weapons_score, drugs_score, offensive_score)
        moderation_score = 1.0 - max_risk  # Invert so higher = safer
        
        # Check if content should be blocked
        is_blocked = (
            nudity_score >= BLOCK_THRESHOLDS["nudity"] or
            alcohol_score >= BLOCK_THRESHOLDS["alcohol"] or
            weapons_score >= BLOCK_THRESHOLDS["weapons"] or
            drugs_score >= BLOCK_THRESHOLDS["drugs"] or
            offensive_score >= BLOCK_THRESHOLDS["offensive"]
        )
        
        # Create moderation result
        moderation_result = ModerationResult(
            is_safe=not is_blocked,
            moderation_score=moderation_score,
            nudity_score=nudity_score,
            alcohol_score=alcohol_score,
            weapons_score=weapons_score,
            drugs_score=drugs_score,
            offensive_score=offensive_score,
            raw_response=result,
            moderated_at=datetime.utcnow(),
            file_path=file_path,
            user_id=user_id
        )
        
        # Determine reason for blocking
        reason = None
        if is_blocked:
            reasons = []
            if nudity_score >= BLOCK_THRESHOLDS["nudity"]:
                reasons.append(f"Nudity detected (score: {nudity_score:.2f})")
            if alcohol_score >= BLOCK_THRESHOLDS["alcohol"]:
                reasons.append(f"Alcohol content detected (score: {alcohol_score:.2f})")
            if weapons_score >= BLOCK_THRESHOLDS["weapons"]:
                reasons.append(f"Weapons detected (score: {weapons_score:.2f})")
            if drugs_score >= BLOCK_THRESHOLDS["drugs"]:
                reasons.append(f"Drugs detected (score: {drugs_score:.2f})")
            if offensive_score >= BLOCK_THRESHOLDS["offensive"]:
                reasons.append(f"Offensive content detected (score: {offensive_score:.2f})")
            reason = "; ".join(reasons)
        
        return ModerationResponse(
            allowed=not is_blocked,
            reason=reason,
            moderation_result=moderation_result
        )
        
    except requests.exceptions.RequestException as e:
        # If API call fails, log but allow upload (fail open for now)
        # In production, you might want to fail closed
        print(f"⚠️ Moderation API error: {str(e)}")
        # For now, allow upload if API fails (you can change this to block)
        return ModerationResponse(
            allowed=True,
            reason="Moderation check failed, upload allowed",
            moderation_result=None
        )
    except Exception as e:
        print(f"❌ Moderation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Moderation check failed: {str(e)}")

async def save_moderation_result(db, moderation_result: ModerationResult, post_id: Optional[str] = None, story_id: Optional[str] = None):
    """
    Save moderation result to database
    
    Args:
        db: Database connection
        moderation_result: ModerationResult object
        post_id: Optional post ID if this is for a post
        story_id: Optional story ID if this is for a story
    """
    try:
        moderation_doc = {
            "user_id": moderation_result.user_id,
            "post_id": post_id,
            "story_id": story_id,
            "file_path": moderation_result.file_path,
            "is_safe": moderation_result.is_safe,
            "moderation_score": moderation_result.moderation_score,
            "nudity_score": moderation_result.nudity_score,
            "alcohol_score": moderation_result.alcohol_score,
            "weapons_score": moderation_result.weapons_score,
            "drugs_score": moderation_result.drugs_score,
            "offensive_score": moderation_result.offensive_score,
            "raw_response": moderation_result.raw_response,
            "moderated_at": moderation_result.moderated_at,
            "created_at": datetime.utcnow(),
        }
        
        await db.moderation_results.insert_one(moderation_doc)
        print(f"✅ Moderation result saved for file: {moderation_result.file_path}")
    except Exception as e:
        print(f"⚠️ Failed to save moderation result: {str(e)}")
        # Don't fail the upload if saving moderation result fails

