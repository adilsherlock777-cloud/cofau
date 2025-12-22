from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Form, WebSocket, Request 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
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
from routers.chat import router as chat_router
from routers.compliments import router as compliments_router
from routers.moderation import router as moderation_router
from routers.leaderboard import router as leaderboard_router

# Import utils
from utils.level_system import calculate_level, add_post_points, calculateUserLevelAfterPost, recalculate_points_from_post_count
from utils.moderation import check_image_moderation, save_moderation_result
from utils.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    
    # Start the leaderboard scheduler
    start_scheduler()
    
    # Log registered routes on startup
    print("=" * 50)
    print("Registered Routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            if hasattr(route, "methods") and route.methods:
                methods = ", ".join(route.methods)
            else:
                methods = "WebSocket"
            print(f"  {methods:15} {route.path}")
    print("=" * 50)
    yield
    
    # Shutdown scheduler
    stop_scheduler()
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
# OPEN GRAPH (WhatsApp Preview) CONFIGURATION
# ======================================================
# Configure the templates directory (must match your folder name)
templates = Jinja2Templates(directory="templates")

async def get_post_data_for_og(post_id: str):
    """
    Fetches dynamic data (Title, Description, Image URL) for the given post ID
    from the database to populate Open Graph tags.
    """
    try:
        db = get_database()
        post_doc = await db.posts.find_one({"_id": ObjectId(post_id)})
        
        if not post_doc:
            return None # Post not found
            
        # Extract necessary fields
        rating = post_doc.get("rating", 0)
        review_text = post_doc.get("review_text", "Check out this great rating on Cofau!")
        
        # Construct the absolute image URL
        # The stored media_url is typically /api/static/uploads/filename.jpg
        # We need the full absolute URL: https://api.cofau.com/api/static/uploads/filename.jpg
        # Assuming your base domain is configured elsewhere, but for simplicity, we'll use a placeholder structure
        
        # NOTE: You MUST replace 'https://api.cofau.com' with your actual domain/URL prefix
        base_domain = "https://api.cofau.com" 
        media_url = post_doc.get("media_url")
        full_image_url = f"{base_domain}{media_url}" if media_url else None
        
        # Determine user who made the post
        user_id = post_doc.get("user_id")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        username = user.get("full_name", "A Cofau User") if user else "A Cofau User"
        
        # The main title for the preview
        title = f"{username} shared a post on Cofau!"
        
        # The description for the preview
        description = f"Rating: {rating}/10. {review_text[:100]}..." # Truncate description for preview
        
        # Construct the full share URL
        full_url = f"{base_domain}/post/{post_id}"

        return {
            "title": title,
            "description": description,
            "image_url": full_image_url,
            "full_url": full_url
        }
    except Exception as e:
        print(f"Error fetching post data for OG tags: {e}")
        return None

# ======================================================

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
app.include_router(chat_router)
app.include_router(compliments_router)
app.include_router(moderation_router)
app.include_router(leaderboard_router)

# ======================================================
# OPEN GRAPH ROUTE (Non-API, for Social Media Scrapers)
# ======================================================
@app.get("/post/{post_id}", response_class=HTMLResponse)
async def share_post_preview(request: Request, post_id: str):
    """
    This route is accessed by WhatsApp/Facebook/Twitter scrapers. 
    It returns an HTML page with Open Graph meta tags.
    """
    post = await get_post_data_for_og(post_id)
    
    if not post:
        # Simple fallback if post is not found
        return HTMLResponse("<html><head><title>Post Not Found</title></head><body>Post not found.</body></html>", status_code=404)

    # Render the HTML template (og_preview.html)
    return templates.TemplateResponse(
        "og_preview.html", 
        {"request": request, "post": post, "post_id": post_id}
    )

# ======================================================

@app.get("/api")
async def root():
    return {"message": "Cofau API is running", "version": "1.0.0"}

@app.get("/api")
async def root():
    return {"message": "Cofau API is running", "version": "1.0.0"}

@app.websocket("/test-ws")
async def test_websocket(websocket: WebSocket):
    """Test WebSocket endpoint directly on the app (bypassing routers)"""
    try:
        print("⚡ Test WebSocket connection attempt")
        await websocket.accept()
        print("⚡ Test WebSocket accepted")
        await websocket.send_text("Hello from WebSocket test endpoint!")
        await websocket.close()
    except Exception as e:
        print(f"⚡ Test WebSocket error: {str(e)}")
        try:
            await websocket.close()
        except:
            pass

# Direct WebSocket endpoint on the main app
@app.websocket("/api/chat/ws/{user_id}")
async def direct_chat_ws(websocket: WebSocket, user_id: str):
    """Direct WebSocket endpoint on the main app (bypassing router)"""
    from routers.chat import chat_ws
    print(f"🔄 Forwarding WebSocket connection to chat_ws handler for user_id: {user_id}")
    await chat_ws(websocket, user_id)


# ======================================================
# POST CREATION
# ======================================================
@app.post("/api/posts/create")
async def create_post(
    rating: int = Form(...),
    review_text: str = Form(...),
    map_link: str = Form(None),
    location_name: str = Form(None),
    category: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    
    # Debug logging for category
    print(f"📝 Creating post with category: '{category}' (type: {type(category)})")
    if category:
        print(f"📝 Category after strip: '{category.strip()}')")

    # Validate file
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    unique_id = str(ObjectId())
    filename = f"{unique_id}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Ensure the upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Verify file was saved
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Failed to save file")
        
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            os.remove(file_path)
            raise HTTPException(status_code=500, detail="File was saved but is empty")
        
        print(f"✅ File saved successfully: {file_path} (size: {file_size} bytes)")
    except Exception as e:
        print(f"❌ Error saving file: {str(e)}")
        # Clean up if file was partially created
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Detect media type
    media_type = "video" if file_ext in ["mp4", "mov"] else "image"

    # ======================================================
    # VIDEO OPTIMIZATION - Transcode to 720p H.264 and generate thumbnail
    # ======================================================
    thumbnail_url = None
    if media_type == "video":
        from utils.video_transcode import should_transcode_video, optimize_video_with_thumbnail
        
        print(f"🎬 Video detected - optimizing to 720p H.264 and generating thumbnail...")
        try:
            # Optimize video to 720p and generate thumbnail
            video_path, thumbnail_path = await optimize_video_with_thumbnail(file_path)
            
            # Update file_path and filename to point to the optimized file
            file_path = video_path
            filename = os.path.basename(video_path)
            
            # Generate thumbnail URL
            thumbnail_filename = os.path.basename(thumbnail_path)
            thumbnail_url = f"/api/static/uploads/{thumbnail_filename}"
            
            print(f"✅ Video optimized to 720p: {filename}")
            print(f"✅ Thumbnail generated: {thumbnail_filename}")
        except Exception as e:
            print(f"❌ Video optimization failed: {str(e)}")
            # Continue with original file if optimization fails
            print(f"⚠️  Using original file (video may be large and slow to load)")

    # ======================================================
    # CONTENT MODERATION - Check for banned content
    # ======================================================
    moderation_result = None
    if media_type == "image":
        moderation_response = check_image_moderation(
            file_path=file_path,
            user_id=str(current_user["_id"])
        )
        
        if not moderation_response.allowed:
            # ❌ BANNED CONTENT DETECTED - Delete file immediately (NOT uploaded to server)
            print(f"🚫 BANNED CONTENT DETECTED - User: {current_user.get('full_name', 'Unknown')} (ID: {current_user['_id']})")
            print(f"   Reason: {moderation_response.reason}")
            print(f"   File: {file_path}")
            
            # Delete the file immediately - it will NOT be saved to server
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"✅ Banned file deleted from server: {file_path}")
                else:
                    print(f"⚠️ File not found (may have been deleted already): {file_path}")
            except Exception as e:
                print(f"❌ CRITICAL: Failed to delete banned file: {str(e)}")
                # Try again
                try:
                    os.remove(file_path)
                except:
                    pass
            
            # Save moderation result for tracking (even though file is deleted)
            if moderation_response.moderation_result:
                await save_moderation_result(
                    db=db,
                    moderation_result=moderation_response.moderation_result,
                    post_id=None  # No post created - upload was blocked
                )
            
            # Block the upload - return error to user
            raise HTTPException(
                status_code=400,
                detail=f"Content not allowed: {moderation_response.reason or 'Banned content detected. Image contains nudity, alcohol, or other prohibited content.'}"
            )
        
        # Save moderation result for allowed content
        if moderation_response.moderation_result:
            # We'll save this after post creation with the post_id
            moderation_result = moderation_response.moderation_result
    # Note: For videos, moderation is optional (Sightengine supports video but it's more expensive)
    # You can add video moderation later if needed

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
    # IMPORTANT: Always use consistent format: /api/static/uploads/filename to match existing posts
    
    # Extract just the filename from the file_path (updated after transcoding if applicable)
    final_filename = os.path.basename(file_path)
    
    # Always use the consistent format: /api/static/uploads/filename
    # This ensures backward compatibility with existing posts
    media_url = f"/api/static/uploads/{final_filename}"
    
    # Debug logging
    print(f"📁 File saved: {file_path}")
    print(f"📁 Filename: {final_filename}")
    print(f"📁 Media URL: {media_url}")

    # ======================================================
    # QUALITY SCORING - Analyze media quality for leaderboard
    # ======================================================
    quality_score = 50.0  # Default score
    try:
        from utils.sightengine_quality import analyze_media_quality
        
        # Build full URL for Sightengine API
        # Assuming backend is accessible at settings.BACKEND_URL or construct it
        backend_url = os.getenv("BACKEND_URL", "https://api.cofau.com")
        full_media_url = f"{backend_url}{media_url}"
        
        # Analyze quality asynchronously
        quality_score = await analyze_media_quality(full_media_url, media_type)
        print(f"✅ Quality score calculated: {quality_score} for {full_media_url}")
    except Exception as e:
        print(f"⚠️ Quality scoring failed, using default: {str(e)}")
        quality_score = 50.0

    post_doc = {
        "user_id": str(current_user["_id"]),
        "media_url": media_url,
        "image_url": media_url if media_type == "image" else None,  # Only set image_url for images
        "thumbnail_url": thumbnail_url,  # Thumbnail for videos
        "media_type": media_type,
        "rating": rating,
        "review_text": review_text,
        "map_link": clean_map_link,
        "location_name": location_name.strip() if location_name else None,
        "category": category.strip() if category else None,  # Add category
        "likes_count": 0,
        "comments_count": 0,
        "popular_photos": [],
        "quality_score": quality_score,  # Add quality score for leaderboard
        "engagement_score": 0.0,  # Will be calculated dynamically
        "combined_score": quality_score * 0.6,  # Initial combined score (60% quality, 0% engagement)
        "created_at": datetime.utcnow(),  # Store as datetime object for proper MongoDB sorting (newest first)
    }

    result = await db.posts.insert_one(post_doc)
    post_id = str(result.inserted_id)
    
    # Debug: Verify category was saved
    print(f"✅ Post created with ID: {post_id}, category: '{post_doc.get('category')}'")

    # Save moderation result with post_id
    if moderation_result:
        await save_moderation_result(
            db=db,
            moderation_result=moderation_result,
            post_id=post_id
        )

    # Level update: recalculate based on total post count × 25 points per post
    user_id = str(current_user["_id"])
    total_posts_count = await db.posts.count_documents({"user_id": user_id})
    level_update = recalculate_points_from_post_count(total_posts_count)

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
    
    print(f"✅ Points updated for user {user_id}: {total_posts_count} posts × 25 = {level_update['total_points']} points, Level {level_update['level']}")

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
async def get_feed(skip: int = 0, limit: int = None, category: str = None, current_user: dict = Depends(get_current_user)):
    """Get feed posts, optionally filtered by category"""
    db = get_database()
    
    # Build query - filter by category if provided
    query = {}
    if category and category.strip() and category.lower() != 'all':
        # Case-insensitive exact match for category
        category_clean = category.strip()
        # Use regex for case-insensitive matching, but escape special characters
        import re
        category_escaped = re.escape(category_clean)
        query["category"] = {"$regex": f"^{category_escaped}$", "$options": "i"}
        print(f"🔍 Filtering posts by category: '{category_clean}' (query: {query})")
    
    # If no limit specified, return all posts (no limit)
    if limit is None:
        posts = await db.posts.find(query).sort("created_at", -1).skip(skip).to_list(None)
    else:
        posts = await db.posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    print(f"📊 Found {len(posts)} posts (category filter: {category if category else 'none'})")

    result = []
    for post in posts:
        post_id = str(post["_id"])
        user_id = post["user_id"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})

        is_liked = await db.likes.find_one({
            "post_id": post_id,
            "user_id": str(current_user["_id"])
        }) is not None

        is_saved = await db.saved_posts.find_one({
            "post_id": post_id,
            "user_id": str(current_user["_id"])
        }) is not None

        # Check if current user is following the post author
        is_following = await db.follows.find_one({
            "follower_id": str(current_user["_id"]),
            "following_id": user_id
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),  # Add location_name
            "category": post.get("category"),  # Add category
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "is_following": is_following,
            # Convert created_at to ISO string for frontend (handles both datetime objects and existing ISO strings)
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
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

# ==================== SAVE POSTS ENDPOINTS ====================

@app.post("/api/posts/{post_id}/save")
async def save_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Save a post"""
    db = get_database()
    
    # Check if post exists
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already saved
    existing_save = await db.saved_posts.find_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if existing_save:
        raise HTTPException(status_code=400, detail="Post already saved")
    
    # Add save
    await db.saved_posts.insert_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"]),
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Post saved"}

@app.delete("/api/posts/{post_id}/save")
async def unsave_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Unsave a post"""
    db = get_database()
    
    result = await db.saved_posts.delete_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Post not saved")
    
    return {"message": "Post unsaved"}

# ==================== SAVED POSTS ENDPOINTS (Alternative API) ====================

@app.post("/api/saved/add")
async def add_saved_post(request: dict, current_user: dict = Depends(get_current_user)):
    """Save a post (alternative endpoint)"""
    db = get_database()
    
    post_id = request.get("postId")
    if not post_id:
        raise HTTPException(status_code=400, detail="postId is required")
    
    # Check if post exists
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already saved
    existing_save = await db.saved_posts.find_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if existing_save:
        return {"message": "Post already saved", "status": "success"}
    
    # Add save
    await db.saved_posts.insert_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"]),
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Post saved", "status": "success"}

@app.delete("/api/saved/remove/{post_id}")
async def remove_saved_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Unsave a post (alternative endpoint)"""
    db = get_database()
    
    result = await db.saved_posts.delete_one({
        "post_id": post_id,
        "user_id": str(current_user["_id"])
    })
    
    if result.deleted_count == 0:
        return {"message": "Post not saved", "status": "success"}
    
    return {"message": "Post unsaved", "status": "success"}

@app.get("/api/saved/list")
async def list_saved_posts(skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get current user's saved posts (alternative endpoint)"""
    db = get_database()
    
    user_id = str(current_user["_id"])
    
    # Get saved posts
    saved_posts = await db.saved_posts.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for saved in saved_posts:
        post = await db.posts.find_one({"_id": ObjectId(saved["post_id"])})
        if not post:
            continue  # Skip if post was deleted
        
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        is_liked = await db.likes.find_one({
            "post_id": saved["post_id"],
            "user_id": str(current_user["_id"])
        }) is not None
        
        media_type = post.get("media_type", "image")
        
        result.append({
            "_id": str(post["_id"]),
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user.get("username", "Unknown") if user else "Unknown",
            "full_name": user.get("full_name", user.get("username", "Unknown")) if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "media_url": post.get("media_url", ""),
            "mediaUrl": post.get("media_url", ""),  # For compatibility
            "image_url": post.get("media_url") if media_type == "image" else None,
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": True,
            "created_at": post["created_at"],
            "saved_at": saved["created_at"]
        })
    
    return result

@app.delete("/api/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a post and its associated media file"""
    db = get_database()
    
    # Find the post
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if the user owns the post
    if str(post["user_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    # Get media URL to delete the file
    media_url = post.get("media_url") or post.get("image_url")
    
    # Delete the media file from server if it exists
    if media_url:
        try:
            # Extract filename from media_url (format: /api/static/uploads/filename)
            if "/api/static/uploads/" in media_url:
                filename = media_url.split("/api/static/uploads/")[-1]
                file_path = os.path.join(settings.UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"✅ Deleted media file: {file_path}")
        except Exception as e:
            print(f"⚠️ Error deleting media file: {e}")
            # Continue with post deletion even if file deletion fails
    
    # Delete related data: likes, comments, saved_posts
    await db.likes.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.saved_posts.delete_many({"post_id": post_id})
    
    # Delete the post
    result = await db.posts.delete_one({"_id": ObjectId(post_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Failed to delete post")
    
    # Recalculate user points based on remaining posts
    # Formula: total_points = number_of_posts × 25
    user_id = str(current_user["_id"])
    remaining_posts_count = await db.posts.count_documents({"user_id": user_id})
    
    # Recalculate level and points
    level_update = recalculate_points_from_post_count(remaining_posts_count)
    
    # Update user's level and points
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
    
    print(f"✅ Points recalculated for user {user_id}: {remaining_posts_count} posts × 25 = {level_update['total_points']} points, Level {level_update['level']}")
    
    return {
        "message": "Post deleted successfully",
        "level_update": level_update
    }

@app.get("/api/users/{user_id}/saved-posts")
async def get_saved_posts(user_id: str, skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get user's saved posts"""
    db = get_database()
    
    # Only allow users to view their own saved posts
    if user_id != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Cannot view other users' saved posts")
    
    # Get saved posts
    saved_posts = await db.saved_posts.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for saved in saved_posts:
        post = await db.posts.find_one({"_id": ObjectId(saved["post_id"])})
        if not post:
            continue  # Skip if post was deleted
        
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        is_liked = await db.likes.find_one({
            "post_id": saved["post_id"],
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
            "image_url": image_url,
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": True,  # Always true for saved posts
            "created_at": post["created_at"],
            "saved_at": saved["created_at"]
        })
    
    return result

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
        
        is_saved = await db.saved_posts.find_one({
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
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
        
        is_saved = await db.saved_posts.find_one({
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
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
        
        is_saved = await db.saved_posts.find_one({
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
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
        
        is_saved = await db.saved_posts.find_one({
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/search/posts")
async def search_posts(
    q: str,
    skip: int = 0,
    limit: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """
    Search posts with intelligent ranking algorithm.
    Searches across: review_text, location_name, and username.
    Ranking based on:
    - Exact matches (highest priority)
    - Partial matches in review_text
    - Location matches
    - Username matches
    - Engagement score (likes + comments + rating)
    - Recency (newer posts ranked higher)
    """
    if not q or not q.strip():
        return []
    
    db = get_database()
    query = q.strip().lower()
    
    # Build MongoDB query to search across multiple fields
    search_regex = {"$regex": query, "$options": "i"}
    
    # Get all posts that match the search query
    all_posts = await db.posts.find({
        "$or": [
            {"review_text": search_regex},
            {"location_name": search_regex},
        ]
    }).to_list(None)
    
    # Also search by username
    users_matching = await db.users.find({
        "full_name": search_regex
    }).to_list(None)
    
    user_ids_matching = [str(u["_id"]) for u in users_matching]
    
    # Get posts from matching users
    posts_by_users = await db.posts.find({
        "user_id": {"$in": user_ids_matching}
    }).to_list(None)
    
    # Combine and deduplicate posts
    all_post_ids = set()
    posts_with_scores = []
    
    # Process posts matching review_text or location_name
    for post in all_posts:
        post_id = str(post["_id"])
        if post_id in all_post_ids:
            continue
        all_post_ids.add(post_id)
        
        # Calculate relevance score
        score = 0
        review_text = (post.get("review_text") or "").lower()
        location_name = (post.get("location_name") or "").lower()
        
        # Exact match in review_text (highest score)
        if query in review_text:
            if review_text.startswith(query) or review_text.endswith(query):
                score += 100  # Starts or ends with query
            else:
                score += 80   # Contains query
        
        # Exact match in location_name
        if query in location_name:
            if location_name.startswith(query):
                score += 90
            else:
                score += 70
        
        # Engagement score (likes + comments + rating * 2)
        engagement = post.get("likes_count", 0) + post.get("comments_count", 0) + (post.get("rating", 0) * 2)
        score += engagement * 0.1
        
        # Recency score (newer posts get higher score)
        created_at = post.get("created_at")
        if created_at:
            try:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                elif not isinstance(created_at, datetime):
                    created_at = None
                
                if created_at:
                    days_old = (datetime.utcnow() - created_at.replace(tzinfo=None)).days
                    recency_score = max(0, 50 - (days_old * 2))  # Decay over time
                    score += recency_score
            except (ValueError, TypeError):
                pass  # Skip recency score if date parsing fails
        
        posts_with_scores.append((post, score))
    
    # Process posts from matching users
    for post in posts_by_users:
        post_id = str(post["_id"])
        if post_id in all_post_ids:
            continue
        all_post_ids.add(post_id)
        
        # Lower score for username matches (indirect match)
        score = 30
        
        # Engagement score
        engagement = post.get("likes_count", 0) + post.get("comments_count", 0) + (post.get("rating", 0) * 2)
        score += engagement * 0.1
        
        # Recency score
        created_at = post.get("created_at")
        if created_at:
            try:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                elif not isinstance(created_at, datetime):
                    created_at = None
                
                if created_at:
                    days_old = (datetime.utcnow() - created_at.replace(tzinfo=None)).days
                    recency_score = max(0, 50 - (days_old * 2))
                    score += recency_score
            except (ValueError, TypeError):
                pass  # Skip recency score if date parsing fails
        
        posts_with_scores.append((post, score))
    
    # Sort by score (descending)
    posts_with_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Apply pagination
    paginated_posts = posts_with_scores[skip:skip + limit]
    
    # Build result
    result = []
    for post, score in paginated_posts:
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        is_liked = await db.likes.find_one({
            "post_id": str(post["_id"]),
            "user_id": str(current_user["_id"])
        }) is not None
        
        is_saved = await db.saved_posts.find_one({
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
            "image_url": image_url,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "caption": post.get("review_text", ""),  # Alias for frontend compatibility
            "location_name": post.get("location_name"),
            "map_link": post.get("map_link"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "created_at": post["created_at"],
            "relevance_score": score  # For debugging/analytics
        })
    
    return result

# ==================== SEARCH ENDPOINTS ====================

@app.get("/api/search/users")
async def search_users(
    q: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Search users by username/full_name OR location_name
    Returns user profiles with basic info and location images from places where user has posted
    """
    if not q or not q.strip():
        return []
    
    db = get_database()
    query = q.strip().lower()
    search_regex = {"$regex": query, "$options": "i"}
    
    # Set to store unique user IDs
    user_ids_set = set()
    result = []
    
    # 1. Search users by full_name
    users_by_name = await db.users.find({
        "full_name": search_regex
    }).limit(limit).to_list(limit)
    
    for user in users_by_name:
        user_id = str(user["_id"])
        if user_id not in user_ids_set:
            user_ids_set.add(user_id)
            
            # Get all posts by this user with location_name
            user_posts = await db.posts.find({
                "user_id": user_id,
                "location_name": {"$exists": True, "$ne": None}
            }).sort("created_at", -1).to_list(None)
            
            # Collect location images from user's posts
            location_images = []
            location_names_set = set()
            
            for post in user_posts:
                location_name = post.get("location_name")
                if location_name and location_name not in location_names_set:
                    location_names_set.add(location_name)
                    
                    # Get all images from this location (from all users, not just this user)
                    location_posts = await db.posts.find({
                        "location_name": location_name
                    }).sort("created_at", -1).limit(20).to_list(20)
                    
                    for loc_post in location_posts:
                        media_type = loc_post.get("media_type", "image")
                        media_url = loc_post.get("media_url") or loc_post.get("image_url")
                        if media_url:
                            location_images.append({
                                "post_id": str(loc_post["_id"]),
                                "media_url": media_url,
                                "media_type": media_type,
                                "location_name": location_name
                            })
            
            result.append({
                "id": user_id,
                "username": user["full_name"],
                "full_name": user["full_name"],
                "profile_picture": user.get("profile_picture"),
                "level": user.get("level", 1),
                "location_images": location_images[:50],  # Limit to 50 images
            })
    
    # 2. Search users by location_name (users who have posts with matching location)
    posts_by_location = await db.posts.find({
        "location_name": search_regex
    }).to_list(None)
    
    # Get unique user IDs from posts with matching location
    location_user_ids = set()
    for post in posts_by_location:
        location_user_ids.add(post["user_id"])
    
    # Fetch users who have posts with matching location
    if location_user_ids:
        users_by_location = await db.users.find({
            "_id": {"$in": [ObjectId(uid) for uid in location_user_ids]}
        }).to_list(None)
        
        for user in users_by_location:
            user_id = str(user["_id"])
            if user_id not in user_ids_set:
                user_ids_set.add(user_id)
                
                # Get all posts by this user with location_name
                user_posts = await db.posts.find({
                    "user_id": user_id,
                    "location_name": {"$exists": True, "$ne": None}
                }).sort("created_at", -1).to_list(None)
                
                # Collect location images from user's posts
                location_images = []
                location_names_set = set()
                
                for post in user_posts:
                    location_name = post.get("location_name")
                    if location_name and location_name not in location_names_set:
                        location_names_set.add(location_name)
                        
                        # Get all images from this location (from all users)
                        location_posts = await db.posts.find({
                            "location_name": location_name
                        }).sort("created_at", -1).limit(20).to_list(20)
                        
                        for loc_post in location_posts:
                            media_type = loc_post.get("media_type", "image")
                            media_url = loc_post.get("media_url") or loc_post.get("image_url")
                            if media_url:
                                location_images.append({
                                    "post_id": str(loc_post["_id"]),
                                    "media_url": media_url,
                                    "media_type": media_type,
                                    "location_name": location_name
                                })
                
                result.append({
                    "id": user_id,
                    "username": user["full_name"],
                    "full_name": user["full_name"],
                    "profile_picture": user.get("profile_picture"),
                    "level": user.get("level", 1),
                    "location_images": location_images[:50],  # Limit to 50 images
                })
    
    # Limit results
    return result[:limit]

@app.get("/api/search/locations")
async def search_locations(
    q: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Search locations/restaurants by name and return preview with photos
    Returns locations with ALL images from posts (not just sample)
    """
    if not q or not q.strip():
        return []
    
    db = get_database()
    query = q.strip().lower()
    search_regex = {"$regex": query, "$options": "i"}
    
    # Find ALL posts with matching location_name (not limited to 50)
    posts = await db.posts.find({
        "location_name": search_regex
    }).sort("created_at", -1).to_list(None)
    
    # Group posts by location_name
    location_map = {}
    for post in posts:
        location_name = post.get("location_name")
        if not location_name:
            continue
        
        if location_name not in location_map:
            location_map[location_name] = {
                "name": location_name,
                "posts": [],
                "total_posts": 0,
                "sample_photos": [],
                "all_images": []  # Store all images for grid display
            }
        
        location_map[location_name]["posts"].append(post)
        location_map[location_name]["total_posts"] += 1
        
        # Collect ALL images (not just 6)
        media_type = post.get("media_type", "image")
        media_url = post.get("media_url") or post.get("image_url")
        if media_url:
            image_data = {
                "post_id": str(post["_id"]),
                "media_url": media_url,
                "media_type": media_type
            }
            location_map[location_name]["all_images"].append(image_data)
            
            # Also keep sample_photos for backward compatibility (first 6)
            if len(location_map[location_name]["sample_photos"]) < 6 and media_type == "image":
                location_map[location_name]["sample_photos"].append(image_data)
    
    # Convert to list and sort by total_posts
    result = []
    for location_name, location_data in location_map.items():
        # Calculate average rating for this location
        ratings = [p.get("rating", 0) for p in location_data["posts"] if p.get("rating")]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        
        result.append({
            "name": location_data["name"],
            "total_posts": location_data["total_posts"],
            "average_rating": round(avg_rating, 1),
            "sample_photos": location_data["sample_photos"][:6],  # Keep for backward compatibility
            "all_images": location_data["all_images"],  # All images for grid display
            "map_link": location_data["posts"][0].get("map_link") if location_data["posts"] else None
        })
    
    # Sort by total_posts (most popular first)
    result.sort(key=lambda x: x["total_posts"], reverse=True)
    
    return result[:limit]

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
    
    # Try both field name formats (snake_case and camelCase)
    follows = await db.follows.find({
        "$or": [
            {"following_id": user_id},
            {"followingId": user_id}
        ]
    }).to_list(100)
    
    print(f"🔍 Found {len(follows)} follow relationships for user {user_id}")
    
    result = []
    for follow in follows:
        # Get follower_id from either field name format
        follower_id = follow.get("follower_id") or follow.get("followerId")
        if not follower_id:
            continue
            
        user = await db.users.find_one({"_id": ObjectId(follower_id)})
        if user:
            result.append({
                "id": str(user["_id"]),
                "user_id": str(user["_id"]),
                "full_name": user.get("full_name") or user.get("username") or "Unknown",
                "username": user.get("username") or user.get("full_name") or "Unknown",
                "profile_picture": user.get("profile_picture"),
                "profile_picture_url": user.get("profile_picture"),
                "badge": user.get("badge"),
                "level": user.get("level", 1)
            })
    
    print(f"✅ Returning {len(result)} followers")
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
        "points": user.get("points", 0),
        "level": user.get("level", 1),
        "currentPoints": user.get("currentPoints", 0),
        "requiredPoints": user.get("requiredPoints", 1250),
        "title": user.get("title", "Reviewer"),
        "badge": user.get("badge"),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
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
    
    # Generate unique filename
    unique_id = str(ObjectId())
    filename = f"profile_{str(current_user['_id'])}_{unique_id}.{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Delete old profile picture if exists
    old_profile_pic = current_user.get("profile_picture")
    if old_profile_pic:
        # Handle old paths
        old_filename = None
        if "/api/static/uploads/" in old_profile_pic:
            old_filename = old_profile_pic.replace("/api/static/uploads/", "")
        elif "/legacy-static/" in old_profile_pic:
            old_filename = old_profile_pic.split("/")[-1]
        
        if old_filename:
            old_path = os.path.join(settings.UPLOAD_DIR, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"🗑️ Deleted old profile picture: {old_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete old profile picture: {e}")
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Calculate relative path for URL
    if os.path.isabs(file_path):
        relative_path = os.path.relpath(file_path, STATIC_DIR)
    else:
        relative_path = file_path.replace(settings.UPLOAD_DIR + os.sep, "").replace(settings.UPLOAD_DIR + "/", "")
    
    profile_image_url = f"/api/static/{relative_path}"
    
    # Update user
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"profile_picture": profile_image_url}}
    )
    
    return {"message": "Profile picture updated", "profile_picture": profile_image_url}


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
async def get_user_posts(user_id: str, media_type: str = None, skip: int = 0, limit: int = None):
    """Get user's posts, optionally filtered by media type. Returns all posts if limit is not specified."""
    db = get_database()
    
    # Build query
    query = {"user_id": user_id}
    if media_type == "photo":
        query["media_type"] = {"$in": ["image", "photo", None]}
    elif media_type == "video":
        query["media_type"] = "video"
    
    # Get posts - return all if limit is None
    if limit is None:
        posts = await db.posts.find(query).sort("created_at", -1).skip(skip).to_list(None)
    else:
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "media_type": post.get("media_type", "photo"),
            "rating": post["rating"],
            "review_text": post["review_text"],
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),  # ✅ Include location_name
            "location": post.get("location_name"),  # For backward compatibility
            "place_name": post.get("location_name"),  # For backward compatibility
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "created_at": post["created_at"]
        })
    
    return result

@app.get("/api/posts/{post_id}")
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single post by ID"""
    db = get_database()
    
    try:
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="Post author not found")
        
        post_id_str = str(post["_id"])
        current_user_id = str(current_user["_id"])
        
        # Check if liked
        is_liked = await db.likes.find_one({
            "post_id": post_id_str,
            "user_id": current_user_id
        }) is not None
        
        # Check if saved
        is_saved = await db.saved_posts.find_one({
            "post_id": post_id_str,
            "user_id": current_user_id
        }) is not None
        
        # Check if current user is following the post author
        is_following = await db.follows.find_one({
            "follower_id": current_user_id,
            "following_id": post["user_id"]
        }) is not None
        
        media_type = post.get("media_type", "image")
        image_url = post.get("image_url") if media_type == "image" else None
        
        return {
            "id": post_id_str,
            "user_id": post["user_id"],
            "username": user.get("username") or user.get("full_name") or "Unknown",
            "user_profile_picture": user.get("profile_picture"),
            "media_url": post.get("media_url", ""),
            "image_url": image_url,
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "is_following": is_following,
            "created_at": post.get("created_at")
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Error fetching post: {str(e)}")

@app.get("/api/users/{user_id}/collaborations")
async def get_user_collaborations(user_id: str, skip: int = 0, limit: int = None):
    """Get user's collaborations (posts where user is tagged or mentioned). Returns all if limit is not specified."""
    db = get_database()
    
    # For now, return posts where the user has commented
    comments = await db.comments.find({"user_id": user_id}).to_list(None)
    post_ids = list(set([comment["post_id"] for comment in comments]))
    
    # Get posts - return all if limit is None
    if limit is None:
        posts = await db.posts.find({
            "_id": {"$in": [ObjectId(pid) for pid in post_ids if ObjectId.is_valid(pid)]},
            "user_id": {"$ne": user_id}  # Exclude own posts
        }).sort("created_at", -1).skip(skip).to_list(None)
    else:
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
            "thumbnail_url": post.get("thumbnail_url"),  # Thumbnail for videos
            "rating": post["rating"],
            "review_text": post["review_text"],
            "likes_count": post["likes_count"],
            "comments_count": post["comments_count"],
            "created_at": post["created_at"]
        })
    
    return result

# ==================== REPORT ENDPOINTS ====================

@app.post("/api/posts/{post_id}/report")
async def report_post(
    post_id: str,
    description: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Report a post with description"""
    db = get_database()
    
    # Check if post exists
    post = await db.posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user already reported this post
    existing_report = await db.reports.find_one({
        "post_id": post_id,
        "reporter_id": str(current_user["_id"])
    })
    
    if existing_report:
        raise HTTPException(status_code=400, detail="You have already reported this post")
    
    # Create report
    report_doc = {
        "post_id": post_id,
        "reporter_id": str(current_user["_id"]),
        "reported_user_id": post["user_id"],
        "description": description.strip(),
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await db.reports.insert_one(report_doc)
    
    return {"message": "Post reported successfully"} 
    
@app.get("/share/{post_id}", response_class=HTMLResponse)
async def share_preview(post_id: str):
    db = get_database()
    post = await db.posts.find_one({"_id": ObjectId(post_id)})

    if not post:
        return HTMLResponse("<h1>Post not found</h1>", status_code=404)

    BASE_URL = "https://api.cofau.com"

    title = post.get("review_text", "Cofau Post")
    rating = post.get("rating", 0)
    location = post.get("location_name", "")
    description = f"Rated {rating}/10 {('- ' + location) if location else ''} on Cofau!"

    # Use media_url (full resolution) first, then image_url, then thumbnail_url
    # For videos, prefer thumbnail_url for better preview
    media_type = post.get("media_type", "image")
    
    if media_type == "video":
        # For videos, use thumbnail_url if available, otherwise media_url
        image_url = post.get("thumbnail_url") or post.get("media_url") or post.get("image_url", "")
    else:
        # For images, use media_url (full resolution) first
        image_url = post.get("media_url") or post.get("image_url", "")
    
    # Ensure full URL
    if image_url and not image_url.startswith("http"):
        image_url = f"{BASE_URL}{image_url}"

    # Use larger dimensions for better preview quality
    # 1920x1080 is optimal for high-quality previews on WhatsApp and Instagram
    image_width = "1920"
    image_height = "1080"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>

        <!-- Open Graph Meta Tags - Enhanced for larger previews -->
        <meta property="og:title" content="{title}" />
        <meta property="og:description" content="{description}" />
        <meta property="og:image" content="{image_url}" />
        <meta property="og:image:secure_url" content="{image_url}" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:url" content="{BASE_URL}/share/{post_id}" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Cofau" />

        <!-- Increased dimensions for larger previews -->
        <meta property="og:image:width" content="{image_width}" />
        <meta property="og:image:height" content="{image_height}" />

        <!-- Twitter Card (helps with previews) -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{title}" />
        <meta name="twitter:description" content="{description}" />
        <meta name="twitter:image" content="{image_url}" />
        <meta name="twitter:image:width" content="{image_width}" />
        <meta name="twitter:image:height" content="{image_height}" />

        <!-- Additional meta for better compatibility -->
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5;">
        <div style="max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="margin-top: 0; color: #333;">{title}</h2>
            <p style="color: #666; margin: 10px 0;">{description}</p>
            <img src="{image_url}" style="width: 100%; max-width: 800px; height: auto; border-radius: 8px; margin-top: 20px;" alt="{title}" />
        </div>
    </body>
    </html>
    """

    return HTMLResponse(content=html)
