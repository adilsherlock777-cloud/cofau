"""
Leaderboard Router

Handles content leaderboard based on quality scores and engagement.

Endpoints:
- GET /api/leaderboard/current: Get current 3-day leaderboard
- GET /api/leaderboard/history: Get historical leaderboards
- POST /api/leaderboard/regenerate: Manually trigger leaderboard regeneration (admin)

Scoring Algorithm:
- Combined Score = (0.6 * Quality Score) + (0.4 * Engagement Score)
- Quality Score: 0-100 from Sightengine API
- Engagement Score: Normalized likes count (0-100)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId
import logging

from routers.auth import get_current_user
from database import get_database
from utils.sightengine_quality import analyze_media_quality

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

# ======================================================
# LEADERBOARD CONFIGURATION
# ======================================================

# Score weights (must sum to 1.0)
QUALITY_WEIGHT = 0.6  # 60% weight for quality score
ENGAGEMENT_WEIGHT = 0.4  # 40% weight for engagement score

# Leaderboard window: 3 days
LEADERBOARD_WINDOW_DAYS = 3

# Top N posts in leaderboard
LEADERBOARD_SIZE = 10


# ======================================================
# SCORING FUNCTIONS
# ======================================================

def calculate_engagement_score(likes_count: int, max_likes: int) -> float:
    """
    Calculate engagement score (0-100) based on likes count.
    
    Formula: (likes / max_likes) * 100
    If max_likes is 0, return 0.
    
    Args:
        likes_count: Number of likes for the post
        max_likes: Maximum likes in the current 3-day window
    
    Returns:
        float: Engagement score between 0-100
    """
    if max_likes == 0:
        return 0.0
    
    engagement_score = (likes_count / max_likes) * 100
    return round(engagement_score, 2)


def calculate_combined_score(quality_score: float, engagement_score: float) -> float:
    """
    Calculate combined score using weighted average.
    
    Formula: (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score)
    
    Args:
        quality_score: Quality score from Sightengine (0-100)
        engagement_score: Normalized engagement score (0-100)
    
    Returns:
        float: Combined score between 0-100
    """
    combined = (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score)
    return round(combined, 2)


# ======================================================
# LEADERBOARD GENERATION
# ======================================================

async def generate_leaderboard_snapshot():
    """
    Generate a new leaderboard snapshot for the current 3-day window.
    
    Process:
    1. Determine 3-day window (current time - 3 days to current time)
    2. Fetch all posts within that window
    3. Calculate engagement scores (normalize by max likes)
    4. Calculate combined scores
    5. Sort by combined score descending
    6. Take top 10 posts
    7. Save snapshot to database
    
    Returns:
        dict: Leaderboard snapshot data
    """
    db = get_database()
    
    # 1. Determine 3-day window
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)
    
    logger.info(f"🏆 Generating leaderboard for window: {from_date} to {to_date}")
    
    # 2. Fetch all posts within the window
    posts = await db.posts.find({
        "created_at": {
            "$gte": from_date.isoformat(),
            "$lte": to_date.isoformat()
        }
    }).to_list(None)
    
    if not posts:
        logger.warning("⚠️ No posts found in 3-day window")
        return None
    
    logger.info(f"📊 Found {len(posts)} posts in window")
    
    # 3. Find max likes for normalization
    max_likes = max([post.get("likes_count", 0) for post in posts])
    if max_likes == 0:
        max_likes = 1  # Avoid division by zero
    
    # 4. Calculate scores for each post
    posts_with_scores = []
    for post in posts:
        quality_score = post.get("quality_score", 50.0)  # Default if not set
        likes_count = post.get("likes_count", 0)
        
        # Calculate engagement score
        engagement_score = calculate_engagement_score(likes_count, max_likes)
        
        # Calculate combined score
        combined_score = calculate_combined_score(quality_score, engagement_score)
        
        # Get user info
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        posts_with_scores.append({
            "post_id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user.get("full_name", "Unknown") if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "media_type": post.get("media_type", "image"),
            "caption": post.get("review_text", ""),
            "location_name": post.get("location_name"),
            "quality_score": quality_score,
            "likes_count": likes_count,
            "engagement_score": engagement_score,
            "combined_score": combined_score,
            "created_at": post.get("created_at")
        })
    
    # 5. Sort by combined score descending
    posts_with_scores.sort(key=lambda x: x["combined_score"], reverse=True)
    
    # 6. Take top 10
    top_posts = posts_with_scores[:LEADERBOARD_SIZE]
    
    # Add rank
    for idx, post in enumerate(top_posts, start=1):
        post["rank"] = idx
    
    # 7. Save snapshot to database
    snapshot = {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "window_days": LEADERBOARD_WINDOW_DAYS,
        "total_posts_analyzed": len(posts),
        "entries": top_posts,
        "config": {
            "quality_weight": QUALITY_WEIGHT,
            "engagement_weight": ENGAGEMENT_WEIGHT,
            "leaderboard_size": LEADERBOARD_SIZE
        }
    }
    
    # Insert into database
    result = await db.leaderboard_snapshots.insert_one(snapshot)
    snapshot["_id"] = str(result.inserted_id)
    
    logger.info(f"✅ Leaderboard snapshot created with {len(top_posts)} entries")
    
    return snapshot


# ======================================================
# API ENDPOINTS
# ======================================================

@router.get("/current")
async def get_current_leaderboard(current_user: dict = Depends(get_current_user)):
    """
    Get the current 3-day leaderboard (top 10 posts).
    
    Returns the most recent leaderboard snapshot.
    If no snapshot exists, generates a new one.
    """
    db = get_database()
    
    # Get the most recent snapshot
    snapshot = await db.leaderboard_snapshots.find_one(
        {},
        sort=[("generated_at", -1)]
    )
    
    # If no snapshot exists or it's too old, generate a new one
    if not snapshot:
        logger.info("📊 No leaderboard snapshot found, generating new one...")
        snapshot = await generate_leaderboard_snapshot()
        
        if not snapshot:
            return {
                "message": "No posts available for leaderboard",
                "entries": []
            }
    else:
        # Check if snapshot is from current window
        snapshot_date = datetime.fromisoformat(snapshot["to_date"])
        current_date = datetime.utcnow()
        
        # If snapshot is more than 3 days old, regenerate
        if (current_date - snapshot_date).days > LEADERBOARD_WINDOW_DAYS:
            logger.info("📊 Leaderboard snapshot is outdated, regenerating...")
            snapshot = await generate_leaderboard_snapshot()
    
    # Format response
    return {
        "from_date": snapshot.get("from_date"),
        "to_date": snapshot.get("to_date"),
        "generated_at": snapshot.get("generated_at"),
        "window_days": snapshot.get("window_days", LEADERBOARD_WINDOW_DAYS),
        "total_posts_analyzed": snapshot.get("total_posts_analyzed", 0),
        "entries": snapshot.get("entries", []),
        "config": snapshot.get("config", {})
    }


@router.get("/history")
async def get_leaderboard_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get historical leaderboard snapshots.
    
    Returns past leaderboards sorted by generation date (newest first).
    """
    db = get_database()
    
    snapshots = await db.leaderboard_snapshots.find(
        {},
        sort=[("generated_at", -1)]
    ).skip(skip).limit(limit).to_list(limit)
    
    # Format response
    result = []
    for snapshot in snapshots:
        result.append({
            "id": str(snapshot["_id"]),
            "from_date": snapshot.get("from_date"),
            "to_date": snapshot.get("to_date"),
            "generated_at": snapshot.get("generated_at"),
            "window_days": snapshot.get("window_days"),
            "total_posts_analyzed": snapshot.get("total_posts_analyzed"),
            "entries_count": len(snapshot.get("entries", [])),
            "top_3": snapshot.get("entries", [])[:3]  # Preview of top 3
        })
    
    return result


@router.post("/regenerate")
async def regenerate_leaderboard(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger leaderboard regeneration.
    
    This endpoint allows admins to force a leaderboard update
    without waiting for the scheduled job.
    """
    # TODO: Add admin check here
    # if not current_user.get("is_admin"):
    #     raise HTTPException(status_code=403, detail="Admin access required")
    
    logger.info(f"🔄 Manual leaderboard regeneration triggered by user {current_user.get('id')}")
    
    snapshot = await generate_leaderboard_snapshot()
    
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="No posts available for leaderboard generation"
        )
    
    return {
        "message": "Leaderboard regenerated successfully",
        "snapshot_id": snapshot.get("_id"),
        "generated_at": snapshot.get("generated_at"),
        "entries_count": len(snapshot.get("entries", []))
    }


@router.get("/post/{post_id}/score")
async def get_post_score(post_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get detailed score breakdown for a specific post.
    
    Shows quality score, engagement score, and combined score.
    """
    db = get_database()
    
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Calculate scores
    quality_score = post.get("quality_score", 0)
    likes_count = post.get("likes_count", 0)
    
    # Get max likes in current window for engagement calculation
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)
    
    posts_in_window = await db.posts.find({
        "created_at": {
            "$gte": from_date.isoformat(),
            "$lte": to_date.isoformat()
        }
    }).to_list(None)
    
    max_likes = max([p.get("likes_count", 0) for p in posts_in_window]) if posts_in_window else 1
    
    engagement_score = calculate_engagement_score(likes_count, max_likes)
    combined_score = calculate_combined_score(quality_score, engagement_score)
    
    return {
        "post_id": post_id,
        "quality_score": quality_score,
        "likes_count": likes_count,
        "engagement_score": engagement_score,
        "combined_score": combined_score,
        "breakdown": {
            "quality_contribution": round(quality_score * QUALITY_WEIGHT, 2),
            "engagement_contribution": round(engagement_score * ENGAGEMENT_WEIGHT, 2)
        },
        "config": {
            "quality_weight": QUALITY_WEIGHT,
            "engagement_weight": ENGAGEMENT_WEIGHT
        }
    }

