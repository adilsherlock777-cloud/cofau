"""
Restaurant Analytics Router
Tracks and returns analytics data for restaurant dashboard:
- Profile views & visits
- Search appearances
- Post clicks
- Followers count
- Customer reviews (posts tagging this restaurant)
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from utils.jwt import verify_token

router = APIRouter(prefix="/api/restaurant", tags=["Restaurant Analytics"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/restaurant/auth/login")


async def get_current_restaurant(token: str = Depends(oauth2_scheme)):
    """Get current restaurant from JWT token"""
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    db = get_database()
    restaurant = await db.restaurants.find_one({"email": email})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    return restaurant


def calculate_trend(current: int, previous: int) -> str:
    """Calculate percentage trend between two periods"""
    if previous == 0:
        if current > 0:
            return "+100% this week"
        return "0% this week"
    
    change = ((current - previous) / previous) * 100
    if change >= 0:
        return f"+{int(change)}% this week"
    return f"{int(change)}% this week"


@router.get("/analytics")
async def get_restaurant_analytics(current_restaurant: dict = Depends(get_current_restaurant)):
    """
    Get analytics data for restaurant dashboard.
    Returns metrics with weekly trends.
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])
    
    # Time ranges for trend calculation
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    # ==================== TOTAL POSTS ====================
    total_posts = await db.restaurant_posts.count_documents({"restaurant_id": restaurant_id})
    
    # Posts this week vs last week
    posts_this_week = await db.restaurant_posts.count_documents({
        "restaurant_id": restaurant_id,
        "created_at": {"$gte": one_week_ago}
    })
    posts_last_week = await db.restaurant_posts.count_documents({
        "restaurant_id": restaurant_id,
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # ==================== FOLLOWERS COUNT ====================
    followers_count = await db.follows.count_documents({"followingId": restaurant_id})
    
    # New followers this week vs last week
    followers_this_week = await db.follows.count_documents({
        "followingId": restaurant_id,
        "createdAt": {"$gte": one_week_ago}
    })
    followers_last_week = await db.follows.count_documents({
        "followingId": restaurant_id,
        "createdAt": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # ==================== CUSTOMER REVIEWS ====================
    # Count user posts that tagged this restaurant
    customer_reviews = await db.posts.count_documents({"tagged_restaurant_id": restaurant_id})
    
    # Reviews this week vs last week
    reviews_this_week = await db.posts.count_documents({
        "tagged_restaurant_id": restaurant_id,
        "created_at": {"$gte": one_week_ago}
    })
    reviews_last_week = await db.posts.count_documents({
        "tagged_restaurant_id": restaurant_id,
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # ==================== ANALYTICS EVENTS ====================
    # Profile Views
    profile_views = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "profile_view"
    })
    views_this_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "profile_view",
        "created_at": {"$gte": one_week_ago}
    })
    views_last_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "profile_view",
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # Profile Visits (unique visitors - using user_id)
    profile_visits_pipeline = [
        {"$match": {
            "restaurant_id": restaurant_id,
            "event_type": "profile_visit"
        }},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    visits_result = await db.restaurant_analytics.aggregate(profile_visits_pipeline).to_list(1)
    profile_visits = visits_result[0]["total"] if visits_result else 0
    
    visits_this_week_pipeline = [
        {"$match": {
            "restaurant_id": restaurant_id,
            "event_type": "profile_visit",
            "created_at": {"$gte": one_week_ago}
        }},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    visits_this_week_result = await db.restaurant_analytics.aggregate(visits_this_week_pipeline).to_list(1)
    visits_this_week = visits_this_week_result[0]["total"] if visits_this_week_result else 0
    
    visits_last_week_pipeline = [
        {"$match": {
            "restaurant_id": restaurant_id,
            "event_type": "profile_visit",
            "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
        }},
        {"$group": {"_id": "$user_id"}},
        {"$count": "total"}
    ]
    visits_last_week_result = await db.restaurant_analytics.aggregate(visits_last_week_pipeline).to_list(1)
    visits_last_week = visits_last_week_result[0]["total"] if visits_last_week_result else 0
    
    # Search Appearances
    search_appearances = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "search_appearance"
    })
    search_this_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "search_appearance",
        "created_at": {"$gte": one_week_ago}
    })
    search_last_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "search_appearance",
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # Post Clicks
    post_clicks = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "post_click"
    })
    clicks_this_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "post_click",
        "created_at": {"$gte": one_week_ago}
    })
    clicks_last_week = await db.restaurant_analytics.count_documents({
        "restaurant_id": restaurant_id,
        "event_type": "post_click",
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    })
    
    # ==================== BUILD RESPONSE ====================
    return {
        "total_posts": total_posts,
        "total_posts_trend": calculate_trend(posts_this_week, posts_last_week),
        
        "followers_count": followers_count,
        "followers_count_trend": calculate_trend(followers_this_week, followers_last_week),
        
        "customer_reviews": customer_reviews,
        "customer_reviews_trend": calculate_trend(reviews_this_week, reviews_last_week),
        
        "profile_views": profile_views,
        "profile_views_trend": calculate_trend(views_this_week, views_last_week),
        
        "profile_visits": profile_visits,
        "profile_visits_trend": calculate_trend(visits_this_week, visits_last_week),
        
        "search_appearances": search_appearances,
        "search_appearances_trend": calculate_trend(search_this_week, search_last_week),
        
        "post_clicks": post_clicks,
        "post_clicks_trend": calculate_trend(clicks_this_week, clicks_last_week),
    }


# ==================== EVENT TRACKING ENDPOINTS ====================
# These endpoints are called from the frontend to track events

# ==================== UNIFIED TRACKING ENDPOINT (Recommended) ====================
from pydantic import BaseModel
from typing import Optional

class TrackEventRequest(BaseModel):
    restaurant_id: str
    event_type: str  # 'profile_view', 'profile_visit', 'search_appearance', 'post_click'
    post_id: Optional[str] = None
    search_query: Optional[str] = None


@router.post("/analytics/track")
async def track_event(
    request: TrackEventRequest,
    token: str = Depends(oauth2_scheme)
):
    """
    Unified tracking endpoint for authenticated users.
    Use this for: profile_view, profile_visit, post_click
    """
    db = get_database()
    
    # Get user from token
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Try to find user (could be regular user or restaurant)
    user = await db.users.find_one({"email": email})
    if not user:
        user = await db.restaurants.find_one({"email": email})
    
    user_id = str(user["_id"]) if user else None
    
    # Don't track if user is viewing their own restaurant
    if user_id and user_id == request.restaurant_id:
        return {"message": "Self-action not tracked", "tracked": False}
    
    # Validate event type
    valid_events = ["profile_view", "profile_visit", "search_appearance", "post_click"]
    if request.event_type not in valid_events:
        raise HTTPException(status_code=400, detail=f"Invalid event_type. Must be one of: {valid_events}")
    
    # Create event document
    event_doc = {
        "restaurant_id": request.restaurant_id,
        "event_type": request.event_type,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    }
    
    # Add optional fields
    if request.post_id:
        event_doc["post_id"] = request.post_id
    if request.search_query:
        event_doc["search_query"] = request.search_query
    
    # For profile_visit, check if already visited today (unique daily visits)
    if request.event_type == "profile_visit" and user_id:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        existing_visit = await db.restaurant_analytics.find_one({
            "restaurant_id": request.restaurant_id,
            "event_type": "profile_visit",
            "user_id": user_id,
            "created_at": {"$gte": today_start}
        })
        if existing_visit:
            return {"message": "Visit already tracked today", "tracked": False}
    
    await db.restaurant_analytics.insert_one(event_doc)
    
    return {"message": f"{request.event_type} tracked", "tracked": True}


@router.post("/analytics/track-anonymous")
async def track_anonymous_event(request: TrackEventRequest):
    """
    Track events without authentication.
    Use this for: search_appearance (when user searches)
    """
    db = get_database()
    
    # Validate event type
    valid_events = ["search_appearance"]
    if request.event_type not in valid_events:
        raise HTTPException(status_code=400, detail=f"Anonymous tracking only allowed for: {valid_events}")
    
    event_doc = {
        "restaurant_id": request.restaurant_id,
        "event_type": request.event_type,
        "user_id": None,
        "created_at": datetime.utcnow()
    }
    
    if request.search_query:
        event_doc["search_query"] = request.search_query
    
    await db.restaurant_analytics.insert_one(event_doc)
    
    return {"message": f"{request.event_type} tracked", "tracked": True}


# ==================== INDIVIDUAL TRACKING ENDPOINTS (Alternative) ====================

@router.post("/track/profile-view/{restaurant_id}")
async def track_profile_view(restaurant_id: str, viewer_id: str = None):
    """
    Track when someone views a restaurant profile.
    Called when restaurant profile page loads.
    """
    db = get_database()
    
    # Verify restaurant exists
    restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Don't track if restaurant views their own profile
    if viewer_id and viewer_id == restaurant_id:
        return {"message": "Self-view not tracked"}
    
    await db.restaurant_analytics.insert_one({
        "restaurant_id": restaurant_id,
        "event_type": "profile_view",
        "user_id": viewer_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Profile view tracked"}


@router.post("/track/profile-visit/{restaurant_id}")
async def track_profile_visit(restaurant_id: str, visitor_id: str = None):
    """
    Track unique profile visits (one per user per day).
    Called when someone interacts with the profile (scrolls, clicks, etc.)
    """
    db = get_database()
    
    # Verify restaurant exists
    restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Don't track if restaurant visits their own profile
    if visitor_id and visitor_id == restaurant_id:
        return {"message": "Self-visit not tracked"}
    
    # Check if this user already visited today (to avoid duplicates)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if visitor_id:
        existing_visit = await db.restaurant_analytics.find_one({
            "restaurant_id": restaurant_id,
            "event_type": "profile_visit",
            "user_id": visitor_id,
            "created_at": {"$gte": today_start}
        })
        
        if existing_visit:
            return {"message": "Visit already tracked today"}
    
    await db.restaurant_analytics.insert_one({
        "restaurant_id": restaurant_id,
        "event_type": "profile_visit",
        "user_id": visitor_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Profile visit tracked"}


@router.post("/track/search-appearance/{restaurant_id}")
async def track_search_appearance(restaurant_id: str, search_query: str = None):
    """
    Track when restaurant appears in search results.
    Called from search endpoint when restaurant is in results.
    """
    db = get_database()
    
    await db.restaurant_analytics.insert_one({
        "restaurant_id": restaurant_id,
        "event_type": "search_appearance",
        "search_query": search_query,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Search appearance tracked"}


@router.post("/track/post-click/{restaurant_id}")
async def track_post_click(restaurant_id: str, post_id: str = None, user_id: str = None):
    """
    Track when someone clicks on a restaurant's post.
    Called when user taps/clicks to view full post.
    """
    db = get_database()
    
    # Don't track if restaurant clicks their own post
    if user_id and user_id == restaurant_id:
        return {"message": "Self-click not tracked"}
    
    await db.restaurant_analytics.insert_one({
        "restaurant_id": restaurant_id,
        "event_type": "post_click",
        "post_id": post_id,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Post click tracked"}


# ==================== DETAILED ANALYTICS (OPTIONAL) ====================

@router.get("/analytics/daily")
async def get_daily_analytics(
    days: int = 7,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Get daily breakdown of analytics for charts.
    Returns data for the last N days.
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])
    
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)
    
    # Aggregate by day
    pipeline = [
        {
            "$match": {
                "restaurant_id": restaurant_id,
                "created_at": {"$gte": start_date}
            }
        },
        {
            "$group": {
                "_id": {
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "event_type": "$event_type"
                },
                "count": {"$sum": 1}
            }
        },
        {
            "$sort": {"_id.date": 1}
        }
    ]
    
    results = await db.restaurant_analytics.aggregate(pipeline).to_list(None)
    
    # Organize by date
    daily_data = {}
    for r in results:
        date = r["_id"]["date"]
        event_type = r["_id"]["event_type"]
        count = r["count"]
        
        if date not in daily_data:
            daily_data[date] = {
                "date": date,
                "profile_views": 0,
                "profile_visits": 0,
                "search_appearances": 0,
                "post_clicks": 0
            }
        
        daily_data[date][event_type + "s" if not event_type.endswith("s") else event_type] = count
    
    # Fill in missing dates with zeros
    result = []
    current_date = start_date
    while current_date <= now:
        date_str = current_date.strftime("%Y-%m-%d")
        if date_str in daily_data:
            result.append(daily_data[date_str])
        else:
            result.append({
                "date": date_str,
                "profile_views": 0,
                "profile_visits": 0,
                "search_appearances": 0,
                "post_clicks": 0
            })
        current_date += timedelta(days=1)
    
    return result


@router.get("/analytics/top-posts")
async def get_top_posts(
    limit: int = 5,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Get top performing posts by clicks.
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])
    
    # Aggregate clicks by post
    pipeline = [
        {
            "$match": {
                "restaurant_id": restaurant_id,
                "event_type": "post_click",
                "post_id": {"$exists": True, "$ne": None}
            }
        },
        {
            "$group": {
                "_id": "$post_id",
                "clicks": {"$sum": 1}
            }
        },
        {
            "$sort": {"clicks": -1}
        },
        {
            "$limit": limit
        }
    ]
    
    click_data = await db.restaurant_analytics.aggregate(pipeline).to_list(limit)
    
    # Get post details
    result = []
    for item in click_data:
        post_id = item["_id"]
        try:
            post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
            if post:
                result.append({
                    "post_id": post_id,
                    "clicks": item["clicks"],
                    "media_url": post.get("media_url"),
                    "about": post.get("about", "")[:50],
                    "likes_count": post.get("likes_count", 0),
                    "created_at": post.get("created_at")
                })
        except:
            continue
    
    return result