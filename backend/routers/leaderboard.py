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
QUALITY_WEIGHT = 0.5  # 50% weight for quality score
ENGAGEMENT_WEIGHT = 0.3  # 30% weight for engagement score
POST_COUNT_WEIGHT = 0.2  # 20% weight for post count (number of posts uploaded in 3 days)

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


def calculate_post_count_score(post_count: int, max_post_count: int) -> float:
    """
    Calculate post count score (0-100) based on number of posts uploaded in 3-day window.
    
    Formula: (post_count / max_post_count) * 100
    If max_post_count is 0, return 0.
    
    Args:
        post_count: Number of posts uploaded by user in the 3-day window
        max_post_count: Maximum posts uploaded by any user in the current 3-day window
    
    Returns:
        float: Post count score between 0-100
    """
    if max_post_count == 0:
        return 0.0
    
    post_count_score = (post_count / max_post_count) * 100
    return round(post_count_score, 2)


def calculate_combined_score(quality_score: float, engagement_score: float, post_count_score: float = 0.0) -> float:
    """
    Calculate combined score using weighted average.
    
    Formula: (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score) + (POST_COUNT_WEIGHT * post_count_score)
    
    Args:
        quality_score: Quality score from Sightengine (0-100)
        engagement_score: Normalized engagement score (0-100)
        post_count_score: Normalized post count score (0-100)
    
    Returns:
        float: Combined score between 0-100
    """
    combined = (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score) + (POST_COUNT_WEIGHT * post_count_score)
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
    try:
        posts = await db.posts.find({
            "created_at": {
                "$gte": from_date.isoformat(),
                "$lte": to_date.isoformat()
            }
        }).to_list(None)
    except Exception as e:
        logger.error(f"❌ Error fetching posts from database: {e}")
        posts = []
    
    if not posts:
        logger.warning("⚠️ No posts found in 3-day window")
        return None
    
    logger.info(f"📊 Found {len(posts)} posts in window")
    
    # 3. Count posts per user in the 3-day window
    user_post_counts = {}
    for post in posts:
        user_id = str(post.get("user_id", ""))
        if user_id:
            user_post_counts[user_id] = user_post_counts.get(user_id, 0) + 1
    
    # Find max post count for normalization
    max_post_count = max(user_post_counts.values()) if user_post_counts else 1
    if max_post_count == 0:
        max_post_count = 1  # Avoid division by zero
    
    logger.info(f"📊 Max posts by a user in window: {max_post_count}")
    
    # 4. Find max likes for normalization
    max_likes = max([post.get("likes_count", 0) for post in posts])
    if max_likes == 0:
        max_likes = 1  # Avoid division by zero
    
    # 5. Calculate scores for each post
    posts_with_scores = []
    for post in posts:
        try:
            quality_score = post.get("quality_score", 50.0)  # Default if not set
            likes_count = post.get("likes_count", 0)
            user_id = str(post.get("user_id", ""))
            
            # Get post count for this user
            user_post_count = user_post_counts.get(user_id, 1)
            
            # Calculate engagement score
            engagement_score = calculate_engagement_score(likes_count, max_likes)
            
            # Calculate post count score
            post_count_score = calculate_post_count_score(user_post_count, max_post_count)
            
            # Calculate combined score (now includes post count)
            combined_score = calculate_combined_score(quality_score, engagement_score, post_count_score)
            
            # Get user info - handle both ObjectId and string user_id
            user = None
            user_id = post.get("user_id")
            if user_id:
                try:
                    # Try as ObjectId first
                    if isinstance(user_id, str):
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
                    else:
                        user = await db.users.find_one({"_id": user_id})
                except Exception as e:
                    logger.warning(f"⚠️ Error fetching user {user_id}: {e}")
                    # Try finding by string ID
                    try:
                        user = await db.users.find_one({"_id": str(user_id)})
                    except:
                        pass
            
            # Get username - try multiple fields
            username = "Unknown"
            if user:
                username = user.get("username") or user.get("full_name") or user.get("name") or "Unknown"
            
            posts_with_scores.append({
                "post_id": str(post["_id"]),
                "user_id": str(user_id) if user_id else "",
                "username": username,
                "user_profile_picture": user.get("profile_picture") if user else None,
                "media_url": post.get("media_url", ""),
                "thumbnail_url": post.get("thumbnail_url"),  # Include thumbnail for better image display
                "media_type": post.get("media_type", "image"),
                "caption": post.get("review_text") or post.get("caption") or post.get("description") or "",
                "location_name": post.get("location_name") or post.get("location") or None,
                "quality_score": quality_score,
                "likes_count": likes_count,
                "engagement_score": engagement_score,
                "post_count": user_post_count,  # Number of posts by this user in 3-day window
                "post_count_score": post_count_score,  # Post count score (0-100)
                "combined_score": combined_score,
                "created_at": post.get("created_at")
            })
        except Exception as e:
            logger.error(f"❌ Error processing post {post.get('_id')}: {e}")
            continue  # Skip this post and continue with others
    
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
            "post_count_weight": POST_COUNT_WEIGHT,
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
    try:
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
                    "from_date": datetime.utcnow().isoformat(),
                    "to_date": datetime.utcnow().isoformat(),
                    "generated_at": datetime.utcnow().isoformat(),
                    "window_days": LEADERBOARD_WINDOW_DAYS,
                    "total_posts_analyzed": 0,
                    "entries": [],
                    "config": {
                        "quality_weight": QUALITY_WEIGHT,
                        "engagement_weight": ENGAGEMENT_WEIGHT,
                        "post_count_weight": POST_COUNT_WEIGHT,
                        "leaderboard_size": LEADERBOARD_SIZE
                    }
                }
        else:
            # Check if snapshot is from current window
            try:
                to_date_str = snapshot.get("to_date")
                current_date = datetime.utcnow()
                current_window_start = current_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)
                
                if to_date_str:
                    # Handle both ISO format strings and datetime objects
                    if isinstance(to_date_str, str):
                        # Handle ISO format with or without timezone
                        if 'Z' in to_date_str:
                            snapshot_date = datetime.fromisoformat(to_date_str.replace('Z', '+00:00'))
                        elif '+' in to_date_str or to_date_str.count('-') >= 3:
                            snapshot_date = datetime.fromisoformat(to_date_str)
                        else:
                            # Assume UTC if no timezone
                            snapshot_date = datetime.fromisoformat(to_date_str + '+00:00')
                    else:
                        snapshot_date = to_date_str
                    
                    # Check if snapshot covers current window
                    # Calculate time difference
                    time_diff = current_date - snapshot_date
                    days_old = time_diff.days
                    hours_old = time_diff.total_seconds() / 3600
                    
                    # Regenerate if snapshot is outdated:
                    # 1. Snapshot's to_date is before current window start (snapshot is too old)
                    # 2. Snapshot is more than 1 day old (ensures fresh data)
                    # This ensures the leaderboard always shows the current 3-day window
                    should_regenerate = (
                        snapshot_date < current_window_start or 
                        days_old >= 1  # Regenerate if at least 1 day old
                    )
                    
                    if should_regenerate:
                        logger.info(f"📊 Leaderboard snapshot is outdated (snapshot to_date: {snapshot_date.strftime('%Y-%m-%d %H:%M')}, current: {current_date.strftime('%Y-%m-%d %H:%M')}, days old: {days_old}), regenerating...")
                        new_snapshot = await generate_leaderboard_snapshot()
                        if new_snapshot:
                            snapshot = new_snapshot
                            logger.info(f"✅ New snapshot generated with window: {new_snapshot.get('from_date')} to {new_snapshot.get('to_date')}")
                        else:
                            # If regeneration failed (no posts), use old snapshot but log warning
                            logger.warning("⚠️ Regeneration failed (no posts in window), using old snapshot")
                    else:
                        logger.info(f"✅ Using existing snapshot (to_date: {snapshot_date.strftime('%Y-%m-%d %H:%M')}, current: {current_date.strftime('%Y-%m-%d %H:%M')}, days old: {days_old})")
                else:
                    # If to_date is missing, regenerate
                    logger.info("📊 Leaderboard snapshot missing to_date, regenerating...")
                    new_snapshot = await generate_leaderboard_snapshot()
                    if new_snapshot:
                        snapshot = new_snapshot
            except Exception as e:
                logger.error(f"❌ Error checking snapshot date: {e}", exc_info=True)
                # If date parsing fails, regenerate
                logger.info("📊 Error parsing snapshot date, regenerating...")
                new_snapshot = await generate_leaderboard_snapshot()
                if new_snapshot:
                    snapshot = new_snapshot
        
        # Ensure snapshot is not None before accessing
        if not snapshot:
            return {
                "from_date": datetime.utcnow().isoformat(),
                "to_date": datetime.utcnow().isoformat(),
                "generated_at": datetime.utcnow().isoformat(),
                "window_days": LEADERBOARD_WINDOW_DAYS,
                "total_posts_analyzed": 0,
                "entries": [],
                "config": {
                    "quality_weight": QUALITY_WEIGHT,
                    "engagement_weight": ENGAGEMENT_WEIGHT,
                    "leaderboard_size": LEADERBOARD_SIZE
                }
            }
        
        # Format response - always use current window dates for display
        # even if using an old snapshot (in case regeneration failed)
        current_to_date = datetime.utcnow()
        current_from_date = current_to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)
        
        # Use snapshot dates if they're recent, otherwise use current window
        snapshot_to_date_str = snapshot.get("to_date")
        if snapshot_to_date_str:
            try:
                if isinstance(snapshot_to_date_str, str):
                    if 'Z' in snapshot_to_date_str:
                        snapshot_to_date = datetime.fromisoformat(snapshot_to_date_str.replace('Z', '+00:00'))
                    else:
                        snapshot_to_date = datetime.fromisoformat(snapshot_to_date_str + '+00:00')
                else:
                    snapshot_to_date = snapshot_to_date_str
                
                # Only use snapshot dates if they're from today or yesterday
                if (current_to_date - snapshot_to_date).days <= 1:
                    # Use snapshot dates
                    response_from_date = snapshot.get("from_date", current_from_date.isoformat())
                    response_to_date = snapshot.get("to_date", current_to_date.isoformat())
                else:
                    # Use current window dates
                    response_from_date = current_from_date.isoformat()
                    response_to_date = current_to_date.isoformat()
                    logger.info(f"📊 Using current window dates in response (snapshot was {((current_to_date - snapshot_to_date).days)} days old)")
            except:
                # If date parsing fails, use current window
                response_from_date = current_from_date.isoformat()
                response_to_date = current_to_date.isoformat()
        else:
            # No snapshot date, use current window
            response_from_date = current_from_date.isoformat()
            response_to_date = current_to_date.isoformat()
        
        return {
            "from_date": response_from_date,
            "to_date": response_to_date,
            "generated_at": snapshot.get("generated_at", datetime.utcnow().isoformat()),
            "window_days": snapshot.get("window_days", LEADERBOARD_WINDOW_DAYS),
            "total_posts_analyzed": snapshot.get("total_posts_analyzed", 0),
            "entries": snapshot.get("entries", []),
            "config": snapshot.get("config", {
                "quality_weight": QUALITY_WEIGHT,
                "engagement_weight": ENGAGEMENT_WEIGHT,
                "leaderboard_size": LEADERBOARD_SIZE
            })
        }
    except Exception as e:
        logger.error(f"❌ Error in get_current_leaderboard: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch leaderboard: {str(e)}"
        )


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
    
    # Count posts by this user in window
    user_post_count = sum(1 for p in posts_in_window if str(p.get("user_id", "")) == str(post.get("user_id", "")))
    max_post_count = max([sum(1 for p in posts_in_window if str(p.get("user_id", "")) == str(uid)) for uid in set(str(p.get("user_id", "")) for p in posts_in_window)]) if posts_in_window else 1
    
    engagement_score = calculate_engagement_score(likes_count, max_likes)
    post_count_score = calculate_post_count_score(user_post_count, max_post_count)
    combined_score = calculate_combined_score(quality_score, engagement_score, post_count_score)
    
    return {
        "post_id": post_id,
        "quality_score": quality_score,
        "likes_count": likes_count,
        "engagement_score": engagement_score,
        "post_count": user_post_count,
        "post_count_score": post_count_score,
        "combined_score": combined_score,
        "breakdown": {
            "quality_contribution": round(quality_score * QUALITY_WEIGHT, 2),
            "engagement_contribution": round(engagement_score * ENGAGEMENT_WEIGHT, 2),
            "post_count_contribution": round(post_count_score * POST_COUNT_WEIGHT, 2)
        },
        "config": {
            "quality_weight": QUALITY_WEIGHT,
            "engagement_weight": ENGAGEMENT_WEIGHT,
            "post_count_weight": POST_COUNT_WEIGHT
        }
    }

