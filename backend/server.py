from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from datetime import datetime
from bson import ObjectId
import os
import shutil

# Import configurations and database
from config import settings
from database import connect_to_mongo, close_mongo_connection, get_database

# Import routers
from routers.auth import router as auth_router, get_current_user
from routers.notifications import router as notifications_router, create_notification
from routers.follow import router as follow_router
from routers.profile_picture import router as profile_picture_router
from routers.stories import router as stories_router
from routers.locations import router as locations_router

# Import utils
from utils.level_system import calculate_level, add_post_points, calculateUserLevelAfterPost


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="Cofau API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)


# ======================================================
# ✅ FIXED STATIC PATH — MAIN CAUSE OF BLANK IMAGES
# ======================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))          # /root/cofau/backend
STATIC_DIR = os.path.join(BASE_DIR, "static")                  # /root/cofau/backend/static

# Fix UPLOAD_DIR to use absolute path (relative paths cause 404 errors)
# Convert relative "static/uploads" to absolute path
if not os.path.isabs(settings.UPLOAD_DIR):
    settings.UPLOAD_DIR = os.path.join(BASE_DIR, settings.UPLOAD_DIR)

print("STATIC DIRECTORY => ", STATIC_DIR)
print("UPLOAD DIRECTORY => ", settings.UPLOAD_DIR)

# Mount static files correctly
app.mount("/api/static", StaticFiles(directory=STATIC_DIR), name="static")

# Create uploads directory if missing
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


# ======================================================
# CORS
# ======================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================================================
# Include Routers
# ======================================================
app.include_router(auth_router)
app.include_router(notifications_router)
app.include_router(follow_router)
app.include_router(profile_picture_router)
app.include_router(stories_router)
app.include_router(locations_router)


@app.get("/api")
async def root():
    return {"message": "Cofau API is running", "version": "1.0.0"}


# ======================================================
# POST CREATION
# ======================================================
@app.post("/api/posts/create")
async def create_post(
    rating: int = Form(...),
    review_text: str = Form(...),
    map_link: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()

    # Validate file
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    unique_id = str(ObjectId())
    filename = f"{unique_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Detect media type
    media_type = "video" if file_ext in ["mp4", "mov"] else "image"

    # Clean map link
    clean_map_link = None
    if map_link:
        map_link = map_link.strip()
        if not map_link.startswith("http"):
            map_link = "https://" + map_link
        if "google.com/maps" in map_link or "goo.gl/maps" in map_link:
            clean_map_link = map_link

    # FIX MEDIA PATH - Calculate relative path from static directory
    # file_path is absolute: /root/cofau/backend/static/uploads/filename.jpg
    # We need: uploads/filename.jpg for URL: /api/static/uploads/filename.jpg
    if os.path.isabs(file_path):
        # Get relative path from STATIC_DIR
        relative_path = os.path.relpath(file_path, STATIC_DIR)
    else:
        # Fallback for relative paths
        relative_path = file_path.replace(settings.UPLOAD_DIR + os.sep, "").replace(settings.UPLOAD_DIR + "/", "")
    
    media_url = f"/api/static/{relative_path}"

    post_doc = {
        "user_id": str(current_user["_id"]),
        "media_url": media_url,
        "image_url": media_url if media_type == "image" else None,  # Only set image_url for images
        "media_type": media_type,
        "rating": rating,
        "review_text": review_text,
        "map_link": clean_map_link,
        "likes_count": 0,
        "comments_count": 0,
        "popular_photos": [],
        "created_at": datetime.utcnow(),
    }

    result = await db.posts.insert_one(post_doc)
    post_id = str(result.inserted_id)

    # Level update
    level_update = calculateUserLevelAfterPost(current_user)

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "total_points": level_update["total_points"],
            "points": level_update["total_points"],
            "level": level_update["level"],
            "currentPoints": level_update["currentPoints"],
            "requiredPoints": level_update["requiredPoints"],
            "title": level_update["title"]
        }}
    )

    # Notify followers
    followers = await db.follows.find({"followingId": str(current_user["_id"])}).to_list(None)
    for follow in followers:
        await create_notification(
            db=db,
            notification_type="new_post",
            from_user_id=str(current_user["_id"]),
            to_user_id=follow["followerId"],
            post_id=post_id,
        )

    return {
        "message": "Post created successfully",
        "post_id": post_id,
        "level_update": level_update,
    }


# ======================================================
# FEED
# ======================================================
@app.get("/api/feed")
async def get_feed(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    db = get_database()
    posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for post in posts:
        post_id = str(post["_id"])
        user_id = post["user_id"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})

        is_liked = await db.likes.find_one({
            "post_id": post_id,
            "user_id": str(current_user["_id"])
        }) is not None

        media_url = post.get("media_url", "")
        media_type = post.get("media_type", "image")
        
        # Only set image_url for images, not videos
        image_url = post.get("image_url") if media_type == "image" else None

        result.append({
            "id": post_id,
            "user_id": user_id,
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "user_badge": user.get("badge") if user else None,
            "user_level": user.get("level", 1),
            "media_url": media_url,
            "image_url": image_url,  # Only for images, None for videos
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "created_at": post["created_at"],
        })

    return result

# ==================== LIKES ENDPOINTS ====================

@app.post("/api/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Like a post"""
    db = get_database()
    
    # Check if already liked
    existing_like = await db.likes.find_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked this post")
    
    # Get post to find owner
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Add like
    await db.likes.insert_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"]),
        "created_at": datetime.utcnow()
    })
    
    # Update post likes count
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": 1}}
    )
    
    # Create notification for post owner
    await create_notification(
        db=db,
        notification_type="like",
        from_user_id=str(current_user["_id"]),
        to_user_id=post["user_id"],
        post_id=post_id
    )
    
    return {"message": "Post liked"}

@app.delete("/api/posts/{post_id}/like")
async def unlike_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Unlike a post"""
    db = get_database()
    
    result = await db.likes.delete_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Like not found")
    
    # Update post likes count
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": -1}}
    )
    
    return {"message": "Post unliked"}

# ==================== COMMENTS ENDPOINTS ====================

@app.post("/api/posts/{post_id}/comment")
async def add_comment(post_id: str, comment_text: str = Form(...), current_user: dict = Depends(get_current_user)):
    """Add a comment to a post"""
    db = get_database()
    
    # Get post to find owner
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_doc = {
        "post_id": post_id,
        "user_id": str(current_user["_id"]),
        "username": current_user["full_name"],
        "profile_pic": current_user.get("profile_picture"),
        "level": current_user.get("level", 1),
        "comment_text": comment_text,
        "created_at": datetime.utcnow()
    }
    
    result = await db.comments.insert_one(comment_doc)
    
    # Update post comments count
    await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"comments_count": 1}}
    )
    
    # Create notification for post owner
    await create_notification(
        db=db,
        notification_type="comment",
        from_user_id=str(current_user["_id"]),
        to_user_id=post["user_id"],
        post_id=post_id
    )
    
    return {"message": "Comment added", "comment_id": str(result.inserted_id)}

@app.get("/api/posts/{post_id}/comments")
async def get_comments(post_id: str):
    """Get all comments for a post"""
    db = get_database()
    
    comments = await db.comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    
    result = []
    for comment in comments:
        result.append({
            "id": str(comment["_id"]),
            "post_id": post_id,
            "user_id": comment["user_id"],
            "username": comment["username"],
            "profile_pic": comment.get("profile_pic"),
            "comment_text": comment["comment_text"],
            "created_at": comment["created_at"]
        })
    
    return result

# ==================== EXPLORE ENDPOINTS ====================

@app.get("/api/explore/trending")
async def get_trending_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get trending posts sorted by engagement"""
    db = get_database()
    
    # Sort by likes_count, rating, and recency
    posts = await db.posts.find().sort([
        ("likes_count", -1),
        ("rating", -1),
        ("created_at", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/explore/top-rated")
async def get_top_rated_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get top-rated posts (rating >= 8)"""
    db = get_database()
    
    # Filter posts with rating >= 8 and sort
    posts = await db.posts.find({"rating": {"$gte": 8}}).sort([
        ("rating", -1),
        ("likes_count", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/explore/reviewers")
async def get_top_reviewers(skip: int = 0, limit: int = 20):
    """Get top reviewers sorted by level and points"""
    db = get_database()
    
    # Get users sorted by level and points
    users = await db.users.find().sort([
        ("level", -1),
        ("points", -1)
    ]).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for user in users:
        # Count posts for this user
        posts_count = await db.posts.count_documents({"user_id": str(user["_id"])})
        
        result.append({
            "id": str(user["_id"]),
            "username": user["full_name"],
            "email": user["email"],
            "profile_picture": user.get("profile_picture"),
            "level": user.get("level", 1),
            "points": user.get("points", 0),
            "badge": user.get("badge"),
            "posts_count": posts_count,
            "followers_count": user.get("followers_count", 0)
        })
    
    return result

@app.get("/api/explore/all")
async def get_explore_all(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get all posts sorted by engagement (likes + comments + rating)"""
    db = get_database()
    
    # Get all posts and calculate engagement score
    posts = await db.posts.find().to_list(None)
    
    # Calculate engagement score for each post
    for post in posts:
        engagement_score = post["likes_count"] + post["comments_count"] + (post["rating"] * 2)
        post["engagement_score"] = engagement_score
    
    # Sort by engagement score
    posts.sort(key=lambda x: x["engagement_score"], reverse=True)
    
    # Apply pagination
    paginated_posts = posts[skip:skip + limit]
    
    result = []
    for post in paginated_posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "engagement_score": post["engagement_score"],
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/explore/category")
async def get_posts_by_category(name: str, skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get posts filtered by category keyword in review text"""
    db = get_database()
    
    # Search for category keyword in review_text (case-insensitive)
    posts = await db.posts.find({
        "review_text": {"$regex": name, "$options": "i"}
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/explore/nearby")
async def get_nearby_posts(lat: float, lng: float, radius_km: float = 10, skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get posts near a location using Haversine formula"""
    db = get_database()
    
    # For now, return all posts (location extraction from map_link would be complex)
    # In production, you'd store lat/lng in the post document
    posts = await db.posts.find().sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "created_at": post["created_at"]
        })
    
    return result

# ==================== FOLLOW ENDPOINTS ====================

@app.post("/api/users/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a user"""
    db = get_database()
    
    if user_id == str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    existing_follow = await db.follows.find_one({
        "follower_id": str(current_user["_id"]),
        "following_id": user_id
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    # Add follow
    await db.follows.insert_one({
        "follower_id": str(current_user["_id"]),
        "following_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    # Update counts
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"following_count": 1}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"followers_count": 1}}
    )
    
    return {"message": "User followed"}

@app.delete("/api/users/{user_id}/follow")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    db = get_database()
    
    result = await db.follows.delete_one({
        "follower_id": str(current_user["_id"]),
        "following_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this user")
    
    # Update counts
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"following_count": -1}}
    )
    
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"followers_count": -1}}
    )
    
    return {"message": "User unfollowed"}

@app.get("/api/users/{user_id}/followers")
async def get_followers(user_id: str):
    """Get user's followers"""
    db = get_database()
    
    follows = await db.follows.find({"following_id": user_id}).to_list(100)
    
    result = []
    for follow in follows:
        user = await db.users.find_one({"_id": ObjectId(follow["follower_id"])})
        if user:
            result.append({
                "id": str(user["_id"]),
                "full_name": user["full_name"],
                "profile_picture": user.get("profile_picture"),
                "badge": user.get("badge")
            })
    
    return result

@app.get("/api/users/{user_id}/following")
async def get_following(user_id: str):
    """Get users that this user is following"""
    db = get_database()
    
    follows = await db.follows.find({"follower_id": user_id}).to_list(100)
    
    result = []
    for follow in follows:
        user = await db.users.find_one({"_id": ObjectId(follow["following_id"])})
        if user:
            result.append({
                "id": str(user["_id"]),
                "full_name": user["full_name"],
                "profile_picture": user.get("profile_picture"),
                "badge": user.get("badge")
            })
    
    return result

# ==================== USER PROFILE ENDPOINTS ====================

@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile by ID"""
    db = get_database()
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "full_name": user["full_name"],
        "email": user["email"],
        "profile_picture": user.get("profile_picture"),
        "bio": user.get("bio"),
        "points": user["points"],
        "level": user["level"],
        "badge": user.get("badge"),
        "followers_count": user["followers_count"],
        "following_count": user["following_count"],
        "created_at": user["created_at"]
    }

@app.put("/api/users/update")
async def update_profile(
    full_name: str = Form(None),
    bio: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    db = get_database()
    
    update_data = {}
    if full_name:
        update_data["full_name"] = full_name
    if bio is not None:
        update_data["bio"] = bio
    
    if update_data:
        result = await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": update_data}
        )
        print(f"✅ Profile updated for user {current_user['_id']}: {update_data}, matched: {result.matched_count}, modified: {result.modified_count}")
    
    return {"message": "Profile updated", "updated": update_data}

@app.put("/api/users/profile-picture")
async def update_profile_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Update profile picture"""
    db = get_database()
    
    # Validate file
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ["jpg", "jpeg", "png", "gif"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    # Save file
    file_path = f"{settings.UPLOAD_DIR}/profile_{str(current_user['_id'])}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update user
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"profile_picture": f"/{file_path}"}}
    )
    
    return {"message": "Profile picture updated", "profile_picture": f"/{file_path}"}


# ==================== LOGOUT ENDPOINT ====================

@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user (token will be handled client-side)"""
    # In a stateless JWT system, logout is mainly handled client-side by removing the token
    # If you want to track logged-out tokens, you'd maintain a blacklist in the database
    return {"message": "Logged out successfully"}

# ==================== USER STATS ENDPOINTS ====================

@app.get("/api/users/{user_id}/stats")
async def get_user_stats(user_id: str):
    """Get user statistics"""
    db = get_database()
    
    # Get user
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count total posts
    total_posts = await db.posts.count_documents({"user_id": user_id})
    
    # Count photos and videos
    posts = await db.posts.find({"user_id": user_id}).to_list(None)
    photos_count = sum(1 for post in posts if post.get("media_type") in ["image", "photo", None])
    videos_count = sum(1 for post in posts if post.get("media_type") == "video")
    
    return {
        "total_posts": total_posts,
        "photos_count": photos_count,
        "videos_count": videos_count,
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "points": user.get("points", 0),
        "level": user.get("level", 1),
        "badge": user.get("badge")
    }

@app.get("/api/users/{user_id}/posts")
async def get_user_posts(user_id: str, media_type: str = None, skip: int = 0, limit: int = 20):
    """Get user's posts, optionally filtered by media type"""
    db = get_database()
    
    # Build query
    query = {"user_id": user_id}
    if media_type == "photo":
        query["media_type"] = {"$in": ["image", "photo", None]}
    elif media_type == "video":
        query["media_type"] = "video"
    
    # Get posts
    posts = await db.posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "media_type": post.get("media_type", "photo"),
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/users/{user_id}/collaborations")
async def get_user_collaborations(user_id: str, skip: int = 0, limit: int = 20):
    """Get user's collaborations (posts where user is tagged or mentioned)"""
    db = get_database()
    
    # For now, return posts where the user has commented
    comments = await db.comments.find({"user_id": user_id}).to_list(None)
    post_ids = list(set([comment["post_id"] for comment in comments]))
    
    # Get posts
    posts = await db.posts.find({
        "_id": {"$in": [ObjectId(pid) for pid in post_ids if ObjectId.is_valid(pid)]},
        "user_id": {"$ne": user_id}  # Exclude own posts
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user["full_name"] if user else "Unknown",
            "media_url": post.get("media_url", ""),
            "image_url": image_url,  # Only for images, None for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "created_at": post["created_at"]
        })
    
    return result
