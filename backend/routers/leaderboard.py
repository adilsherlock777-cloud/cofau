"""
Leaderboard Router

Handles content leaderboard based on quality scores and engagement.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timedelta
from typing import List, Optional
from bson import ObjectId
import logging
from zoneinfo import ZoneInfo  # ✅ ADDED (only import change)

from routers.auth import get_current_user
from database import get_database
from utils.sightengine_quality import analyze_media_quality

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])

# ======================================================
# LEADERBOARD CONFIGURATION
# ======================================================

QUALITY_WEIGHT = 0.6
ENGAGEMENT_WEIGHT = 0.4
LEADERBOARD_WINDOW_DAYS = 3
LEADERBOARD_SIZE = 10

IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")

# ======================================================
# SCORING FUNCTIONS
# ======================================================

def normalize_rating_to_quality_score(rating: float) -> float:
    if rating > 10:
        return min(rating, 100.0)
    return round(min(rating * 10, 100.0), 2)


def calculate_engagement_score(likes_count: int, max_likes: int) -> float:
    if max_likes == 0:
        return 0.0
    return round((likes_count / max_likes) * 100, 2)


def calculate_combined_score(quality_score: float, engagement_score: float) -> float:
    return round(
        (QUALITY_WEIGHT * quality_score) + (ENGAGEMENT_WEIGHT * engagement_score),
        2
    )


def parse_datetime_safe(date_str: str) -> datetime:
    if isinstance(date_str, datetime):
        return date_str.replace(tzinfo=None)

    try:
        if 'Z' in date_str:
            dt = datetime.fromisoformat(date_str.replace('Z', ''))
        elif '+' in date_str:
            dt = datetime.fromisoformat(date_str)
            dt = dt.replace(tzinfo=None)
        else:
            dt = datetime.fromisoformat(date_str)
        return dt
    except Exception as e:
        logger.error(f"Error parsing datetime '{date_str}': {e}")
        return datetime.utcnow()


def serialize_document(doc):
    """
    Recursively convert MongoDB document to JSON-serializable format.
    Converts ObjectId to string and datetime to ISO string.
    """
    if doc is None:
        return None
    
    if isinstance(doc, ObjectId):
        return str(doc)
    
    if isinstance(doc, datetime):
        return doc.isoformat()
    
    if isinstance(doc, dict):
        return {key: serialize_document(value) for key, value in doc.items()}
    
    if isinstance(doc, list):
        return [serialize_document(item) for item in doc]
    
    return doc

# ======================================================
# LEADERBOARD GENERATION
# ======================================================

async def generate_leaderboard_snapshot():
    db = get_database()

    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)

    logger.info(
        f"🏆 Generating leaderboard for rolling 3-day window: "
        f"{from_date.isoformat()} to {to_date.isoformat()}"
    )

    try:
        all_posts = await db.posts.find(
            {"media_type": "image"}
        ).to_list(None)

        posts = []

        for post in all_posts:
            created_at_raw = post.get("created_at")
            if not created_at_raw:
                continue

            # ✅ FIX 1: proper datetime parsing
            created_at = parse_datetime_safe(created_at_raw)

            # ✅ FIX 2: treat DB timestamps as IST → convert to UTC
            created_at = (
                created_at
                .replace(tzinfo=IST)
                .astimezone(UTC)
                .replace(tzinfo=None)
            )

            # ✅ FIX 3: real datetime comparison
            if from_date <= created_at <= to_date:
                posts.append(post)

        logger.info(f"📊 Found {len(posts)} PHOTOS in 3-day window")

    except Exception as e:
        logger.error(f"❌ Error fetching posts from database: {e}")
        posts = []

    if not posts:
        logger.warning(
            f"⚠️ No PHOTOS found in 3-day window "
            f"({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})"
        )
        return None

    max_likes = max([post.get("likes_count", 0) for post in posts]) or 1

    posts_with_scores = []

    for post in posts:
        try:
            rating = post.get("rating", 5.0)
            quality_score = normalize_rating_to_quality_score(rating)
            likes_count = post.get("likes_count", 0)

            engagement_score = calculate_engagement_score(likes_count, max_likes)
            combined_score = calculate_combined_score(
                quality_score, engagement_score
            )

            user = None
            user_id = post.get("user_id")

            if user_id:
                try:
                    user = await db.users.find_one(
                        {"_id": ObjectId(user_id)}
                    )
                except:
                    user = await db.users.find_one(
                        {"_id": str(user_id)}
                    )

            username = (
                user.get("username")
                if user else "Unknown"
            )

            # Convert created_at to ISO string if it's a datetime object
            created_at_value = post.get("created_at")
            if isinstance(created_at_value, datetime):
                created_at_str = created_at_value.isoformat()
            elif created_at_value:
                created_at_str = str(created_at_value)
            else:
                created_at_str = None

            posts_with_scores.append({
                "post_id": str(post["_id"]),
                "user_id": str(user_id) if user_id else "",
                "username": username,
                "user_profile_picture": user.get("profile_picture") if user else None,
                "media_url": post.get("media_url", ""),
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "caption": post.get("review_text") or post.get("caption") or "",
                "location_name": post.get("location_name"),
                "rating": rating,
                "quality_score": quality_score,
                "likes_count": likes_count,
                "engagement_score": engagement_score,
                "combined_score": combined_score,
                "created_at": created_at_str
            })

        except Exception as e:
            logger.error(f"❌ Error processing post {post.get('_id')}: {e}")

    posts_with_scores.sort(
        key=lambda x: x["combined_score"],
        reverse=True
    )

    top_posts = posts_with_scores[:LEADERBOARD_SIZE]

    for idx, post in enumerate(top_posts, start=1):
        post["rank"] = idx

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

    await db.leaderboard_snapshots.insert_one(snapshot)
    logger.info(f"✅ Leaderboard snapshot created with {len(top_posts)} entries")

    return snapshot


# ======================================================
# API ENDPOINTS
# ======================================================

@router.get("/current")
async def get_current_leaderboard(current_user: dict = Depends(get_current_user)):
    """
    Get the current leaderboard snapshot.
    If no snapshot exists or it's outdated (>3 days old), generate a new one.
    """
    db = get_database()
    
    try:
        # Find the most recent snapshot
        latest_snapshot = await db.leaderboard_snapshots.find_one(
            sort=[("generated_at", -1)]
        )
        
        should_regenerate = False
        
        if not latest_snapshot:
            logger.info("📊 No leaderboard snapshot found, generating new one...")
            should_regenerate = True
        else:
            # Check if snapshot is outdated
            generated_at_str = latest_snapshot.get("generated_at")
            if generated_at_str:
                generated_at = parse_datetime_safe(generated_at_str)
                age_days = (datetime.utcnow() - generated_at).days
                
                if age_days >= LEADERBOARD_WINDOW_DAYS:
                    logger.info(
                        f"📊 Leaderboard snapshot is {age_days} days old "
                        f"(threshold: {LEADERBOARD_WINDOW_DAYS} days), regenerating..."
                    )
                    should_regenerate = True
                else:
                    logger.info(
                        f"✅ Using existing leaderboard snapshot "
                        f"(age: {age_days} days)"
                    )
            else:
                logger.warning("⚠️ Snapshot missing generated_at, regenerating...")
                should_regenerate = True
        
        if should_regenerate:
            snapshot = await generate_leaderboard_snapshot()
            if not snapshot:
                # Return empty leaderboard if no posts found
                return {
                    "from_date": (datetime.utcnow() - timedelta(days=LEADERBOARD_WINDOW_DAYS)).isoformat(),
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
            # Serialize the snapshot to ensure all ObjectIds and datetimes are converted
            return serialize_document(snapshot)
        else:
            # Serialize the entire snapshot to handle ObjectIds and datetimes
            serialized = serialize_document(latest_snapshot)
            # Remove MongoDB _id from response
            serialized.pop("_id", None)
            return serialized
            
    except Exception as e:
        logger.error(f"❌ Error getting current leaderboard: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve leaderboard: {str(e)}"
        )

