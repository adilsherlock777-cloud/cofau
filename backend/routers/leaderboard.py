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
from utils.level_system import get_level_from_total_points

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
            followers_count = 0
            following_count = 0
            posts_count = 0
            user_level = 1  # Default level - ALWAYS initialize to ensure it's always set

            if user_id:
                try:
                    # Try ObjectId first
                    try:
                        user = await db.users.find_one(
                            {"_id": ObjectId(user_id)}
                        )
                    except:
                        # Try as string
                        user = await db.users.find_one(
                            {"_id": str(user_id)}
                        )
                    
                    # Debug: Log what we found
                    if user:
                        logger.info(f"🔍 Found user {user_id}")
                        logger.info(f"🔍 Available fields: {list(user.keys())}")
                        logger.info(f"🔍 full_name={user.get('full_name')}, username={user.get('username')}, email={user.get('email')}")
                    else:
                        logger.warning(f"⚠️ User {user_id} not found in users collection")
                        
                except Exception as e:
                    logger.error(f"❌ Error looking up user {user_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    user = None
                
                # Get user stats if user exists
                if user:
                    followers_count = user.get("followers_count", 0)
                    following_count = user.get("following_count", 0)
                    
                    # Get user level - match feed endpoint logic exactly: user.get("level", 1)
                    # This matches how feed, profile, and explore endpoints get the level
                    user_level = user.get("level", 1)
                    
                    # If level is missing or 0, try to calculate from total_points as fallback
                    if user_level is None or user_level < 1:
                        total_points = user.get("total_points", 0)
                        if total_points > 0:
                            # Calculate level from total_points
                            level_info = get_level_from_total_points(total_points)
                            user_level = level_info.get("level", 1)
                            logger.info(f"📊 User {user_id} level calculated from total_points {total_points}: {user_level}")
                        else:
                            user_level = 1
                    else:
                        logger.debug(f"📊 User {user_id} level from user document: {user_level}")
                else:
                    # User not found - keep default level of 1
                    logger.warning(f"⚠️ User {user_id} not found, using default level 1")
                
                # Count user's posts - try multiple formats to ensure we get the count
                # Posts might have user_id as ObjectId or string format
                posts_count = 0
                if user_id:
                    try:
                        # Get the actual user_id values to try (from user document if available, or from post)
                        user_obj_id = None
                        user_str_id = str(user_id)
                        
                        # If user exists, use user's _id for more accurate matching
                        if user and user.get("_id"):
                            user_obj_id = user["_id"]
                            if not isinstance(user_obj_id, ObjectId):
                                try:
                                    user_obj_id = ObjectId(str(user_obj_id))
                                except:
                                    user_obj_id = None
                            user_str_id = str(user["_id"])
                        else:
                            # Try to convert post's user_id to ObjectId
                            try:
                                user_obj_id = ObjectId(user_id)
                            except:
                                user_obj_id = None
                        
                        # Try both ObjectId and string formats, take the maximum count
                        count_objid = 0
                        count_string = 0
                        
                        if user_obj_id:
                            try:
                                count_objid = await db.posts.count_documents({"user_id": user_obj_id})
                            except Exception as e:
                                logger.debug(f"Could not count with ObjectId: {e}")
                        
                        try:
                            count_string = await db.posts.count_documents({"user_id": user_str_id})
                        except Exception as e:
                            logger.debug(f"Could not count with string: {e}")
                        
                        # Take the maximum (one should work)
                        posts_count = max(count_objid, count_string)
                        
                        logger.info(f"📊 Posts count for user {user_id}: ObjectId={count_objid}, String={count_string}, Final={posts_count}")
                                    
                    except Exception as e:
                        logger.error(f"❌ Error counting posts for user {user_id}: {e}")
                        import traceback
                        traceback.print_exc()
                        posts_count = 0

            # Get username and full_name with proper fallbacks
            username = None
            full_name = None
            
            if user:
                # Try multiple field name variations
                username = (
                    user.get("username") or 
                    user.get("userName") or 
                    user.get("user_name") or 
                    (user.get("email", "").split("@")[0] if user.get("email") else None)
                )
                
                full_name = (
                    user.get("full_name") or 
                    user.get("fullName") or 
                    user.get("name") or 
                    user.get("display_name")
                )
                
                # If full_name is not available, use username as fallback
                if not full_name and username:
                    full_name = username
                
                # Ensure both have values
                if not username:
                    username = full_name or "User_" + str(user_id)[:8]
                
                if not full_name:
                    full_name = username
                
                # Debug logging
                logger.info(f"✅ User {user_id}: username={username}, full_name={full_name}")
            else:
                # If user not found, try to get from post data as last resort
                post_username = post.get("username") or post.get("user_name")
                post_full_name = post.get("full_name") or post.get("fullName")
                
                if post_username:
                    username = post_username
                    full_name = post_full_name or post_username
                elif post_full_name:
                    username = post_full_name
                    full_name = post_full_name
                else:
                    username = "User_" + str(user_id)[:8]
                    full_name = username
                
                logger.warning(f"⚠️ User {user_id} not found in DB, using fallback: username={username}, full_name={full_name}")

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
                "username": username or "Unknown",  # Ensure username is never None
                "full_name": full_name,  # Can be None, frontend will handle
                "user_profile_picture": user.get("profile_picture") if user else None,
                "user_level": user_level,  # User's level (1-12)
                "level": user_level,  # Alias for compatibility
                "followers_count": followers_count,
                "following_count": following_count,
                "posts_count": posts_count,
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
# RESTAURANT LEADERBOARD GENERATION
# ======================================================

async def generate_restaurant_leaderboard_snapshot():
    """Generate leaderboard for restaurant posts"""
    db = get_database()

    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)

    logger.info(
        f"🏆 Generating RESTAURANT leaderboard for rolling 3-day window: "
        f"{from_date.isoformat()} to {to_date.isoformat()}"
    )

    try:
        all_posts = await db.restaurant_posts.find(
            {"media_type": "image"}
        ).to_list(None)

        posts = []

        for post in all_posts:
            created_at_raw = post.get("created_at")
            if not created_at_raw:
                continue

            created_at = parse_datetime_safe(created_at_raw)
            created_at = (
                created_at
                .replace(tzinfo=IST)
                .astimezone(UTC)
                .replace(tzinfo=None)
            )

            if from_date <= created_at <= to_date:
                posts.append(post)

        logger.info(f"📊 Found {len(posts)} RESTAURANT PHOTOS in 3-day window")

    except Exception as e:
        logger.error(f"❌ Error fetching restaurant posts from database: {e}")
        posts = []

    if not posts:
        logger.warning(
            f"⚠️ No RESTAURANT PHOTOS found in 3-day window "
            f"({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})"
        )
        return None

    max_likes = max([post.get("likes_count", 0) for post in posts]) or 1

    posts_with_scores = []

    for post in posts:
        try:
            # For restaurants, use a default quality score or calculate differently
            # Since restaurants might not have "rating", we can use likes more heavily
            rating = post.get("rating", 5.0)
            quality_score = normalize_rating_to_quality_score(rating)
            likes_count = post.get("likes_count", 0)

            engagement_score = calculate_engagement_score(likes_count, max_likes)
            combined_score = calculate_combined_score(
                quality_score, engagement_score
            )

            user = None
            user_id = post.get("user_id")
            followers_count = 0
            following_count = 0
            posts_count = 0

            if user_id:
                try:
                    try:
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
                    except:
                        user = await db.users.find_one({"_id": str(user_id)})
                except Exception as e:
                    logger.error(f"❌ Error looking up restaurant user {user_id}: {e}")
                    user = None

                if user:
                    followers_count = user.get("followers_count", 0)
                    following_count = user.get("following_count", 0)

                # Count restaurant posts for this user
                if user_id:
                    try:
                        user_str_id = str(user_id)
                        posts_count = await db.restaurant_posts.count_documents({"user_id": user_str_id})
                    except Exception as e:
                        logger.error(f"❌ Error counting restaurant posts for user {user_id}: {e}")
                        posts_count = 0

            # Get restaurant name and details
            restaurant_name = None
            if user:
                restaurant_name = (
                    user.get("restaurant_name") or
                    user.get("full_name") or
                    user.get("username") or
                    "Unknown Restaurant"
                )
            else:
                restaurant_name = post.get("restaurant_name") or "Unknown Restaurant"

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
                "username": restaurant_name,
                "full_name": restaurant_name,
                "user_profile_picture": user.get("profile_picture") if user else None,
                "user_level": user.get("level", 1) if user else 1,
                "level": user.get("level", 1) if user else 1,
                "followers_count": followers_count,
                "following_count": following_count,
                "posts_count": posts_count,
                "media_url": post.get("media_url", ""),
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "caption": post.get("about") or post.get("caption") or "",
                "location_name": post.get("location_name"),
                "price": post.get("price"),
                "about": post.get("about"),
                "rating": rating,
                "quality_score": quality_score,
                "likes_count": likes_count,
                "engagement_score": engagement_score,
                "combined_score": combined_score,
                "created_at": created_at_str,
                "account_type": "restaurant"
            })

        except Exception as e:
            logger.error(f"❌ Error processing restaurant post {post.get('_id')}: {e}")

    posts_with_scores.sort(key=lambda x: x["combined_score"], reverse=True)
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

    await db.restaurant_leaderboard_snapshots.insert_one(snapshot)
    logger.info(f"✅ Restaurant leaderboard snapshot created with {len(top_posts)} entries")

    return snapshot

# ======================================================
# RESTAURANT LEADERBOARD ENDPOINTS
# ======================================================

@router.get("/restaurants/current")
async def get_current_restaurant_leaderboard(
    force_refresh: bool = Query(False, description="Force regenerate leaderboard"),
    current_user: dict = Depends(get_current_user)
):
    """Get the current restaurant leaderboard snapshot."""
    db = get_database()
    
    try:
        latest_snapshot = await db.restaurant_leaderboard_snapshots.find_one(
            sort=[("generated_at", -1)]
        )
        
        should_regenerate = force_refresh
        
        if force_refresh:
            logger.info("🔄 Force refresh requested, regenerating restaurant leaderboard...")
            await db.restaurant_leaderboard_snapshots.delete_many({})
        elif not latest_snapshot:
            logger.info("📊 No restaurant leaderboard snapshot found, generating new one...")
            should_regenerate = True
        else:
            generated_at_str = latest_snapshot.get("generated_at")
            if generated_at_str:
                generated_at = parse_datetime_safe(generated_at_str)
                age_days = (datetime.utcnow() - generated_at).days
                
                if age_days >= LEADERBOARD_WINDOW_DAYS:
                    should_regenerate = True
        
        if should_regenerate:
            snapshot = await generate_restaurant_leaderboard_snapshot()
            if not snapshot:
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
            return serialize_document(snapshot)
        else:
            serialized = serialize_document(latest_snapshot)
            serialized.pop("_id", None)
            return serialized
            
    except Exception as e:
        logger.error(f"❌ Error getting restaurant leaderboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve restaurant leaderboard: {str(e)}")


@router.post("/restaurants/refresh")
async def refresh_restaurant_leaderboard(current_user: dict = Depends(get_current_user)):
    """Force refresh the restaurant leaderboard."""
    db = get_database()
    
    try:
        result = await db.restaurant_leaderboard_snapshots.delete_many({})
        logger.info(f"🗑️ Cleared {result.deleted_count} cached restaurant leaderboard snapshots")
        
        snapshot = await generate_restaurant_leaderboard_snapshot()
        
        if not snapshot:
            return {
                "message": "Restaurant leaderboard refreshed but no posts found",
                "entries": []
            }
        
        return {
            "message": "Restaurant leaderboard refreshed successfully",
            "entries_count": len(snapshot.get("entries", []))
        }
        
    except Exception as e:
        logger.error(f"❌ Error refreshing restaurant leaderboard: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh restaurant leaderboard: {str(e)}")


# ======================================================
# API ENDPOINTS
# ======================================================

@router.get("/current")
async def get_current_leaderboard(
    force_refresh: bool = Query(False, description="Force regenerate leaderboard"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current leaderboard snapshot.
    If no snapshot exists or it's outdated (>3 days old), generate a new one.
    Use force_refresh=true to force regeneration.
    """
    db = get_database()
    
    try:
        # Find the most recent snapshot
        latest_snapshot = await db.leaderboard_snapshots.find_one(
            sort=[("generated_at", -1)]
        )
        
        should_regenerate = force_refresh
        
        if force_refresh:
            logger.info("🔄 Force refresh requested, regenerating leaderboard...")
            # Clear old snapshots when force refreshing
            await db.leaderboard_snapshots.delete_many({})
        elif not latest_snapshot:
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


@router.post("/refresh")
async def refresh_leaderboard(current_user: dict = Depends(get_current_user)):
    """
    Force refresh the leaderboard by clearing all cached snapshots and generating a new one.
    """
    db = get_database()
    
    try:
        # Delete all existing snapshots
        result = await db.leaderboard_snapshots.delete_many({})
        logger.info(f"🗑️ Cleared {result.deleted_count} cached leaderboard snapshots")
        
        # Generate fresh snapshot
        snapshot = await generate_leaderboard_snapshot()
        
        if not snapshot:
            return {
                "message": "Leaderboard refreshed but no posts found in the time window",
                "from_date": (datetime.utcnow() - timedelta(days=LEADERBOARD_WINDOW_DAYS)).isoformat(),
                "to_date": datetime.utcnow().isoformat(),
                "entries": []
            }
        
        return {
            "message": "Leaderboard refreshed successfully",
            "entries_count": len(snapshot.get("entries", [])),
            "from_date": snapshot.get("from_date"),
            "to_date": snapshot.get("to_date"),
            "generated_at": snapshot.get("generated_at")
        }
        
    except Exception as e:
        logger.error(f"❌ Error refreshing leaderboard: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh leaderboard: {str(e)}"
        )

# ======================================================
# TOP CONTRIBUTORS - LAST 3 DAYS (New Feature)
# ======================================================

@router.get("/top-contributors/users")
async def get_top_contributor_users(
    limit: int = Query(10, description="Number of top contributors to return"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get top 10 users ranked by posts count in the LAST 3 DAYS.
    Each user includes their 3 latest posts and 2 most liked posts.
    """
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Calculate date range - last 3 days
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=3)
    
    logger.info(f"📊 Fetching top contributors from {from_date.isoformat()} to {to_date.isoformat()}")
    
    # Get blocked user IDs to exclude
    blocked_user_ids = []
    try:
        blocks = await db.blocks.find({"blocker_id": current_user_id}).to_list(None)
        blocked_user_ids = [block["blocked_id"] for block in blocks]
    except Exception as e:
        logger.warning(f"Could not fetch blocked users: {e}")
    
    # Get all posts from last 3 days
    all_posts = await db.posts.find().to_list(None)
    
    # Filter posts from last 3 days
    recent_posts = []
    for post in all_posts:
        created_at_raw = post.get("created_at")
        if not created_at_raw:
            continue
        
        # Parse datetime
        created_at = parse_datetime_safe(created_at_raw)
        
        # Convert IST to UTC if needed
        created_at = (
            created_at
            .replace(tzinfo=IST)
            .astimezone(UTC)
            .replace(tzinfo=None)
        )
        
        # Check if within last 3 days
        if from_date <= created_at <= to_date:
            user_id = post.get("user_id")
            # Exclude blocked users
            if user_id and user_id not in blocked_user_ids:
                recent_posts.append(post)
    
    logger.info(f"📊 Found {len(recent_posts)} posts in last 3 days")
    
    # Group posts by user_id and count
    user_posts_count = {}
    for post in recent_posts:
        user_id = post.get("user_id")
        if user_id:
            if user_id not in user_posts_count:
                user_posts_count[user_id] = 0
            user_posts_count[user_id] += 1
    
    # Sort by posts count (descending) and take top N
    sorted_users = sorted(user_posts_count.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    logger.info(f"📊 Top {len(sorted_users)} users by post count in last 3 days")
    
    contributors = []
    
    for idx, (user_id, posts_count_3days) in enumerate(sorted_users):
        # Get user details
        user = None
        try:
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        except:
            pass
        
        if not user:
            try:
                user = await db.users.find_one({"_id": user_id})
            except:
                pass
        
        if not user:
            logger.warning(f"User {user_id} not found, skipping")
            continue
        
        # Get total posts count (all time)
        total_posts_count = await db.posts.count_documents({"user_id": user_id})
        
        # Get 3 latest posts (from last 3 days)
        user_recent_posts = [p for p in recent_posts if p.get("user_id") == user_id]
        user_recent_posts.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
        
        latest_posts = []
        for post in user_recent_posts[:3]:
            media_type = post.get("media_type", "image")
            thumbnail = post.get("thumbnail_url") if media_type == "video" else post.get("media_url")
            latest_posts.append({
                "post_id": str(post["_id"]),
                "thumbnail_url": thumbnail,
                "media_url": post.get("media_url"),
                "media_type": media_type
            })
        
        # Get 2 most liked posts (from last 3 days)
        user_recent_posts.sort(key=lambda x: x.get("likes_count", 0), reverse=True)
        
        most_liked_posts = []
        for post in user_recent_posts[:2]:
            media_type = post.get("media_type", "image")
            thumbnail = post.get("thumbnail_url") if media_type == "video" else post.get("media_url")
            most_liked_posts.append({
                "post_id": str(post["_id"]),
                "thumbnail_url": thumbnail,
                "media_url": post.get("media_url"),
                "media_type": media_type,
                "likes_count": post.get("likes_count", 0)
            })
        
        # Check if current user is following this user
        is_following = await db.follows.find_one({
            "followerId": current_user_id,
            "followingId": user_id
        }) is not None
        
        user_level = user.get("level", 1)
        if user_level is None or user_level < 1:
            user_level = 1
        
        contributors.append({
            "rank": idx + 1,
            "user_id": user_id,
            "username": user.get("username") or user.get("full_name") or "Unknown",
            "full_name": user.get("full_name") or user.get("username") or "Unknown",
            "profile_picture": user.get("profile_picture"),
            "bio": user.get("bio"),
            "level": user_level,
            "followers_count": user.get("followers_count", 0),
            "posts_count": total_posts_count,  # Total posts (all time)
            "posts_count_3days": posts_count_3days,  # Posts in last 3 days
            "is_following": is_following,
            "latest_posts": latest_posts,
            "most_liked_posts": most_liked_posts
        })
    
    logger.info(f"✅ Top Contributors (Users): Returned {len(contributors)} users from last 3 days")
    
    return {
        "contributors": contributors,
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "window_days": 3
    }


@router.get("/top-contributors/restaurants")
async def get_top_contributor_restaurants(
    limit: int = Query(10, description="Number of top contributors to return"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get top 10 restaurants ranked by posts count in the LAST 3 DAYS.
    Each restaurant includes their 3 latest posts and 2 most liked posts.
    """
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Calculate date range - last 3 days
    to_date = datetime.utcnow()
    from_date = to_date - timedelta(days=3)
    
    logger.info(f"📊 Fetching top restaurant contributors from {from_date.isoformat()} to {to_date.isoformat()}")
    
    # Get all restaurant posts from last 3 days
    all_posts = await db.restaurant_posts.find().to_list(None)
    
    # Filter posts from last 3 days
    recent_posts = []
    for post in all_posts:
        created_at_raw = post.get("created_at")
        if not created_at_raw:
            continue
        
        # Parse datetime
        created_at = parse_datetime_safe(created_at_raw)
        
        # Convert IST to UTC if needed
        created_at = (
            created_at
            .replace(tzinfo=IST)
            .astimezone(UTC)
            .replace(tzinfo=None)
        )
        
        # Check if within last 3 days
        if from_date <= created_at <= to_date:
            restaurant_id = post.get("restaurant_id")
            if restaurant_id:
                recent_posts.append(post)
    
    logger.info(f"📊 Found {len(recent_posts)} restaurant posts in last 3 days")
    
    # Group posts by restaurant_id and count
    restaurant_posts_count = {}
    for post in recent_posts:
        restaurant_id = post.get("restaurant_id")
        if restaurant_id:
            if restaurant_id not in restaurant_posts_count:
                restaurant_posts_count[restaurant_id] = 0
            restaurant_posts_count[restaurant_id] += 1
    
    # Sort by posts count (descending) and take top N
    sorted_restaurants = sorted(restaurant_posts_count.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    logger.info(f"📊 Top {len(sorted_restaurants)} restaurants by post count in last 3 days")
    
    contributors = []
    
    for idx, (restaurant_id, posts_count_3days) in enumerate(sorted_restaurants):
        # Get restaurant details
        restaurant = None
        try:
            restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
        except:
            pass
        
        if not restaurant:
            try:
                restaurant = await db.restaurants.find_one({"_id": restaurant_id})
            except:
                pass
        
        if not restaurant:
            logger.warning(f"Restaurant {restaurant_id} not found, skipping")
            continue
        
        # Get total posts count (all time)
        total_posts_count = await db.restaurant_posts.count_documents({"restaurant_id": restaurant_id})
        
        # Get 3 latest posts (from last 3 days)
        rest_recent_posts = [p for p in recent_posts if p.get("restaurant_id") == restaurant_id]
        rest_recent_posts.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
        
        latest_posts = []
        for post in rest_recent_posts[:3]:
            media_type = post.get("media_type", "image")
            thumbnail = post.get("thumbnail_url") if media_type == "video" else post.get("media_url")
            latest_posts.append({
                "post_id": str(post["_id"]),
                "thumbnail_url": thumbnail,
                "media_url": post.get("media_url"),
                "media_type": media_type
            })
        
        # Get 2 most liked posts (from last 3 days)
        rest_recent_posts.sort(key=lambda x: x.get("likes_count", 0), reverse=True)
        
        most_liked_posts = []
        for post in rest_recent_posts[:2]:
            media_type = post.get("media_type", "image")
            thumbnail = post.get("thumbnail_url") if media_type == "video" else post.get("media_url")
            most_liked_posts.append({
                "post_id": str(post["_id"]),
                "thumbnail_url": thumbnail,
                "media_url": post.get("media_url"),
                "media_type": media_type,
                "likes_count": post.get("likes_count", 0)
            })
        
        # Check if current user is following this restaurant
        is_following = await db.follows.find_one({
            "followerId": current_user_id,
            "followingId": restaurant_id
        }) is not None
        
        # Get followers count
        followers_count = await db.follows.count_documents({"followingId": restaurant_id})
        
        contributors.append({
            "rank": idx + 1,
            "user_id": restaurant_id,
            "username": restaurant.get("restaurant_name") or "Unknown",
            "full_name": restaurant.get("restaurant_name") or "Unknown",
            "profile_picture": restaurant.get("profile_picture"),
            "bio": restaurant.get("bio"),
            "level": None,  # Restaurants don't have levels
            "followers_count": followers_count,
            "posts_count": total_posts_count,  # Total posts (all time)
            "posts_count_3days": posts_count_3days,  # Posts in last 3 days
            "is_following": is_following,
            "latest_posts": latest_posts,
            "most_liked_posts": most_liked_posts
        })
    
    logger.info(f"✅ Top Contributors (Restaurants): Returned {len(contributors)} restaurants from last 3 days")
    
    return {
        "contributors": contributors,
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "window_days": 3
    }
