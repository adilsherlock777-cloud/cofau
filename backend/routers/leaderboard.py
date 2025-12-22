"""
Leaderboard Router

Handles content leaderboard based on quality scores and engagement.

Endpoints:
- GET /api/leaderboard/current: Get current 3-day rolling leaderboard
- GET /api/leaderboard/history: Get historical leaderboards
- POST /api/leaderboard/regenerate: Manually trigger leaderboard regeneration (admin)

Scoring Algorithm:
- Combined Score = (0.6 * Quality Score) + (0.4 * Engagement Score)
- Quality Score: 0-100 from rating field (normalized from 0-10 scale to 0-100)
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
ENGAGEMENT_WEIGHT = 0.4  # 40% weight for engagement score (likes)

# Leaderboard window: 3 days (rolling window)
LEADERBOARD_WINDOW_DAYS = 3

# Top N posts in leaderboard
LEADERBOARD_SIZE = 10


# ======================================================
# SCORING FUNCTIONS
# ======================================================

def normalize_rating_to_quality_score(rating: float) -> float:
    """
    Normalize rating (0-10 scale) to quality score (0-100 scale).
    
    Args:
        rating: Rating value (typically 0-10)
    
    Returns:
        float: Quality score between 0-100
    """
    # If rating is already in 0-100 range, return as is
    if rating > 10:
        return min(rating, 100.0)
    
    # Convert 0-10 scale to 0-100 scale
    quality_score = rating * 10.0
    return round(min(quality_score, 100.0), 2)


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
        quality_score: Quality score from rating (0-100)
        engagement_score: Normalized engagement score (0-100)
    
    Returns:
        float: Combined score between 0-100
    """
    combined = (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score)
    return round(combined, 2)


def parse_datetime_safe(date_str: str) -> datetime:
    """
    Safely parse datetime string to datetime object.
    Handles various ISO format variations.
    Returns timezone-naive datetime to match database format.
    
    Args:
        date_str: ISO format datetime string
    
    Returns:
        datetime: Parsed datetime object (timezone-naive)
    """
    if isinstance(date_str, datetime):
        # Already a datetime object - remove timezone if present
        if date_str.tzinfo is not None:
            return date_str.replace(tzinfo=None)
        return date_str
    
    try:
        # Try parsing with different formats
        if 'Z' in date_str:
            # Replace Z with empty string and parse
            dt = datetime.fromisoformat(date_str.replace('Z', ''))
        elif '+' in date_str:
            # Has timezone info - parse and remove timezone
            dt = datetime.fromisoformat(date_str)
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
        else:
            # No timezone
            dt = datetime.fromisoformat(date_str)
        
        return dt
    except Exception as e:
        logger.error(f"Error parsing datetime '{date_str}': {e}")
        # Return current time as fallback
        return datetime.utcnow()


# ======================================================
# LEADERBOARD GENERATION
# ======================================================

async def generate_leaderboard_snapshot():
    """
    Generate a new leaderboard snapshot for the current 3-day rolling window.
    
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
    
    # 1. Determine 3-day rolling window (always shows last 3 days)
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)
    
    logger.info(f"🏆 Generating leaderboard for rolling 3-day window: {from_date.isoformat()} to {to_date.isoformat()}")
    
    # 2. Fetch all posts within the window
    # Convert dates to ISO strings for MongoDB comparison
    from_date_str = from_date.isoformat()
    to_date_str = to_date.isoformat()
    
    try:
        posts = await db.posts.find({
            "created_at": {
                "$gte": from_date_str,
                "$lte": to_date_str
            }
        }).to_list(None)
        
        logger.info(f"📊 Query: created_at >= {from_date_str} AND created_at <= {to_date_str}")
        logger.info(f"📊 Found {len(posts)} posts in database query")
    except Exception as e:
        logger.error(f"❌ Error fetching posts from database: {e}")
        posts = []
    
    if not posts:
        logger.warning(f"⚠️ No posts found in 3-day window ({from_date_str} to {to_date_str})")
        # Let's check total posts in database for debugging
        try:
            total_posts = await db.posts.count_documents({})
            logger.info(f"📊 Total posts in database: {total_posts}")
            
            # Get a sample post to see date format
            sample_post = await db.posts.find_one({})
            if sample_post:
                logger.info(f"📊 Sample post created_at: {sample_post.get('created_at')} (type: {type(sample_post.get('created_at'))})")
        except Exception as e:
            logger.error(f"❌ Error checking database: {e}")
        
        return None
    
    # 3. Find max likes for normalization
    max_likes = max([post.get("likes_count", 0) for post in posts])
    if max_likes == 0:
        max_likes = 1  # Avoid division by zero
    
    logger.info(f"📊 Max likes in window: {max_likes}")
    
    # 4. Calculate scores for each post
    posts_with_scores = []
    for post in posts:
        try:
            # Get quality score from 'rating' field (not 'quality_score')
            rating = post.get("rating", 5.0)  # Default to 5 if not set
            quality_score = normalize_rating_to_quality_score(rating)
            
            likes_count = post.get("likes_count", 0)
            
            # Calculate engagement score
            engagement_score = calculate_engagement_score(likes_count, max_likes)
            
            # Calculate combined score
            combined_score = calculate_combined_score(quality_score, engagement_score)
            
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
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "caption": post.get("review_text") or post.get("caption") or post.get("description") or "",
                "location_name": post.get("location_name") or post.get("location") or None,
                "rating": rating,  # Original rating (0-10)
                "quality_score": quality_score,  # Normalized to 0-100
                "likes_count": likes_count,
                "engagement_score": engagement_score,
                "combined_score": combined_score,
                "created_at": post.get("created_at")
            })
            
            logger.debug(f"✓ Post {post['_id']}: rating={rating}, quality={quality_score}, likes={likes_count}, engagement={engagement_score}, combined={combined_score}")
            
        except Exception as e:
            logger.error(f"❌ Error processing post {post.get('_id')}: {e}")
            continue
    
    logger.info(f"📊 Successfully processed {len(posts_with_scores)} posts with scores")
    
    # 5. Sort by combined score descending
    posts_with_scores.sort(key=lambda x: x["combined_score"], reverse=True)
    
    # 6. Take top 10
    top_posts = posts_with_scores[:LEADERBOARD_SIZE]
    
    # Add rank
    for idx, post in enumerate(top_posts, start=1):
        post["rank"] = idx
    
    logger.info(f"🏆 Top 3 posts: {[(p['rank'], p['username'], p['combined_score']) for p in top_posts[:3]]}")
    
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
    try:
        result = await db.leaderboard_snapshots.insert_one(snapshot)
        snapshot["_id"] = str(result.inserted_id)
        logger.info(f"✅ Leaderboard snapshot saved with ID: {snapshot['_id']}")
    except Exception as e:
        logger.error(f"❌ Error saving snapshot to database: {e}")
    
    logger.info(f"✅ Leaderboard snapshot created with {len(top_posts)} entries")
    
    return snapshot


# ======================================================
# API ENDPOINTS
# ======================================================

@router.get("/current")
async def get_current_leaderboard(current_user: dict = Depends(get_current_user)):
    """
    Get the current 3-day rolling leaderboard (top 10 posts).
    
    Returns the most recent leaderboard snapshot.
    Regenerates daily to always show the last 3 days of posts.
    """
    try:
        db = get_database()
        
        # Get the most recent snapshot
        snapshot = await db.leaderboard_snapshots.find_one(
            {},
            sort=[("generated_at", -1)]
        )
        
        # Determine if we need to regenerate
        should_regenerate = False
        current_time = datetime.utcnow()
        
        if not snapshot:
            logger.info("📊 No leaderboard snapshot found, generating new one...")
            should_regenerate = True
        else:
            # Check if snapshot is from today
            try:
                generated_at_str = snapshot.get("generated_at")
                if generated_at_str:
                    generated_at = parse_datetime_safe(generated_at_str)
                    
                    # Calculate hours since last generation
                    time_diff = current_time - generated_at
                    hours_since_generation = time_diff.total_seconds() / 3600
                    
                    # Regenerate if more than 12 hours old (twice daily updates for rolling window)
                    if hours_since_generation >= 12:
                        logger.info(f"📊 Snapshot is {hours_since_generation:.1f} hours old, regenerating...")
                        should_regenerate = True
                    else:
                        logger.info(f"✅ Using existing snapshot (generated {hours_since_generation:.1f} hours ago)")
                else:
                    should_regenerate = True
            except Exception as e:
                logger.error(f"❌ Error checking snapshot age: {e}")
                should_regenerate = True
        
        # Regenerate if needed
        if should_regenerate:
            new_snapshot = await generate_leaderboard_snapshot()
            if new_snapshot:
                snapshot = new_snapshot
            elif not snapshot:
                # No snapshot and regeneration failed
                return {
                    "from_date": (current_time - timedelta(days=LEADERBOARD_WINDOW_DAYS)).isoformat(),
                    "to_date": current_time.isoformat(),
                    "generated_at": current_time.isoformat(),
                    "window_days": LEADERBOARD_WINDOW_DAYS,
                    "total_posts_analyzed": 0,
                    "entries": [],
                    "config": {
                        "quality_weight": QUALITY_WEIGHT,
                        "engagement_weight": ENGAGEMENT_WEIGHT,
                        "leaderboard_size": LEADERBOARD_SIZE
                    }
                }
        
        # Return snapshot
        return {
            "from_date": snapshot.get("from_date"),
            "to_date": snapshot.get("to_date"),
            "generated_at": snapshot.get("generated_at"),
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
    
    This endpoint allows users to force a leaderboard update.
    """
    logger.info(f"🔄 Manual leaderboard regeneration triggered by user {current_user.get('id')}")
    
    snapshot = await generate_leaderboard_snapshot()
    
    if not snapshot:
        raise HTTPException(
            status_code=404,
            detail="No posts available for leaderboard generation in the last 3 days"
        )
    
    return {
        "message": "Leaderboard regenerated successfully",
        "snapshot_id": snapshot.get("_id"),
        "generated_at": snapshot.get("generated_at"),
        "entries_count": len(snapshot.get("entries", [])),
        "window": {
            "from": snapshot.get("from_date"),
            "to": snapshot.get("to_date")
        }
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
    rating = post.get("rating", 5.0)
    quality_score = normalize_rating_to_quality_score(rating)
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
        "rating": rating,
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
