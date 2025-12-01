"""
Moderation Router - View banned images and moderation results
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime
from typing import Optional, List
from database import get_database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/moderation", tags=["moderation"])


@router.get("/banned")
async def get_banned_images(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    nudity_only: bool = Query(False, description="Filter only nudity violations"),
    alcohol_only: bool = Query(False, description="Filter only alcohol violations"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of banned images (blocked uploads)
    Shows moderation results for images that were blocked
    """
    try:
        db = get_database()
        
        # Build query filter
        query_filter = {"is_safe": False}  # Only show banned/unsafe content
        
        # Add specific filters
        if nudity_only:
            query_filter["nudity_score"] = {"$gte": 0.2}  # Above nudity threshold
        if alcohol_only:
            query_filter["alcohol_score"] = {"$gte": 0.3}  # Above alcohol threshold
        
        # Get banned images
        banned_results = await db.moderation_results.find(query_filter)\
            .sort("moderated_at", -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(limit)
        
        # Get total count
        total_count = await db.moderation_results.count_documents(query_filter)
        
        # Format response
        results = []
        for result in banned_results:
            # Get user info if available
            user_info = None
            if result.get("user_id"):
                try:
                    user = await db.users.find_one({"_id": ObjectId(result["user_id"])})
                    if user:
                        user_info = {
                            "id": str(user["_id"]),
                            "username": user.get("full_name") or user.get("username", "Unknown"),
                            "email": user.get("email", "N/A")
                        }
                except:
                    pass
            
            results.append({
                "id": str(result["_id"]),
                "user": user_info,
                "file_path": result.get("file_path", "N/A"),
                "moderation_score": result.get("moderation_score", 0.0),
                "nudity_score": result.get("nudity_score", 0.0),
                "alcohol_score": result.get("alcohol_score", 0.0),
                "weapons_score": result.get("weapons_score", 0.0),
                "drugs_score": result.get("drugs_score", 0.0),
                "offensive_score": result.get("offensive_score", 0.0),
                "violations": _get_violations(result),
                "moderated_at": result.get("moderated_at").isoformat() if result.get("moderated_at") else None,
                "created_at": result.get("created_at").isoformat() if result.get("created_at") else None,
            })
        
        return {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "banned_images": results
        }
    
    except Exception as e:
        print(f"❌ Error fetching banned images: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch banned images: {str(e)}")


@router.get("/stats")
async def get_moderation_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get moderation statistics
    """
    try:
        db = get_database()
        
        # Total moderation checks
        total_checks = await db.moderation_results.count_documents({})
        
        # Banned/unsafe content
        banned_count = await db.moderation_results.count_documents({"is_safe": False})
        
        # Safe content
        safe_count = await db.moderation_results.count_documents({"is_safe": True})
        
        # Nudity violations
        nudity_violations = await db.moderation_results.count_documents({
            "nudity_score": {"$gte": 0.2}
        })
        
        # Alcohol violations
        alcohol_violations = await db.moderation_results.count_documents({
            "alcohol_score": {"$gte": 0.3}
        })
        
        # Weapons violations
        weapons_violations = await db.moderation_results.count_documents({
            "weapons_score": {"$gte": 0.3}
        })
        
        # Drugs violations
        drugs_violations = await db.moderation_results.count_documents({
            "drugs_score": {"$gte": 0.3}
        })
        
        # Offensive violations
        offensive_violations = await db.moderation_results.count_documents({
            "offensive_score": {"$gte": 0.5}
        })
        
        return {
            "total_checks": total_checks,
            "safe_content": safe_count,
            "banned_content": banned_count,
            "violations_by_type": {
                "nudity": nudity_violations,
                "alcohol": alcohol_violations,
                "weapons": weapons_violations,
                "drugs": drugs_violations,
                "offensive": offensive_violations
            },
            "block_rate": round((banned_count / total_checks * 100) if total_checks > 0 else 0, 2)
        }
    
    except Exception as e:
        print(f"❌ Error fetching moderation stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


@router.get("/recent")
async def get_recent_moderations(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get recent moderation results (both safe and banned)
    """
    try:
        db = get_database()
        
        recent_results = await db.moderation_results.find({})\
            .sort("moderated_at", -1)\
            .limit(limit)\
            .to_list(limit)
        
        results = []
        for result in recent_results:
            user_info = None
            if result.get("user_id"):
                try:
                    user = await db.users.find_one({"_id": ObjectId(result["user_id"])})
                    if user:
                        user_info = {
                            "id": str(user["_id"]),
                            "username": user.get("full_name") or user.get("username", "Unknown")
                        }
                except:
                    pass
            
            results.append({
                "id": str(result["_id"]),
                "user": user_info,
                "is_safe": result.get("is_safe", True),
                "file_path": result.get("file_path", "N/A"),
                "moderation_score": result.get("moderation_score", 0.0),
                "nudity_score": result.get("nudity_score", 0.0),
                "alcohol_score": result.get("alcohol_score", 0.0),
                "violations": _get_violations(result) if not result.get("is_safe") else [],
                "moderated_at": result.get("moderated_at").isoformat() if result.get("moderated_at") else None,
            })
        
        return {
            "recent_moderations": results
        }
    
    except Exception as e:
        print(f"❌ Error fetching recent moderations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent moderations: {str(e)}")


def _get_violations(result: dict) -> List[str]:
    """Helper function to determine which violations were detected"""
    violations = []
    
    if result.get("nudity_score", 0.0) >= 0.2:
        violations.append(f"Nudity (score: {result.get('nudity_score', 0.0):.2f})")
    
    if result.get("alcohol_score", 0.0) >= 0.3:
        violations.append(f"Alcohol (score: {result.get('alcohol_score', 0.0):.2f})")
    
    if result.get("weapons_score", 0.0) >= 0.3:
        violations.append(f"Weapons (score: {result.get('weapons_score', 0.0):.2f})")
    
    if result.get("drugs_score", 0.0) >= 0.3:
        violations.append(f"Drugs (score: {result.get('drugs_score', 0.0):.2f})")
    
    if result.get("offensive_score", 0.0) >= 0.5:
        violations.append(f"Offensive (score: {result.get('offensive_score', 0.0):.2f})")
    
    return violations

