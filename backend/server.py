from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Form, WebSocket, Request 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
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
from routers import restaurant_auth
from routers import restaurant_posts

# Import utils
from utils.level_system import calculate_level, add_post_points, calculateUserLevelAfterPost, recalculate_points_from_post_count
from utils.moderation import check_image_moderation, save_moderation_result
from utils.scheduler import start_scheduler, stop_scheduler
from utils.location_matcher import normalize_location_name, find_similar_location, get_location_suggestions
import random
from datetime import datetime, timedelta

def calculate_explore_score(post, current_time):
    """
    Calculate explore score with:
    - Base engagement score (likes, comments, rating)
    - Freshness bonus (new posts get boosted)
    - Random boost (for variety on each refresh)
    
    This creates Instagram-like "Exploration vs Exploitation" balance.
    """
    # Base engagement score
    likes = post.get("likes_count", 0)
    comments = post.get("comments_count", 0)
    rating = post.get("rating", 0)
    
    # Weighted engagement: comments are more valuable than likes
    base_score = (likes * 3) + (comments * 4) + (rating * 2)
    
    # Freshness bonus - newer posts get a significant boost
    created_at = post.get("created_at")
    freshness_bonus = 0
    hours_since_posted = 9999  # Default for posts without date
    
    if created_at:
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                created_at = created_at.replace(tzinfo=None)
            except:
                created_at = None
        
        if created_at and isinstance(created_at, datetime):
            time_diff = current_time - created_at
            hours_since_posted = time_diff.total_seconds() / 3600
            
            # Freshness bonus system:
            # - Posts < 24h: +72 points (big boost for brand new)
            # - Posts 24-48h: +48 points
            # - Posts 48-72h: decreasing from 24 to 0
            # - Posts > 72h: 0 points
            if hours_since_posted < 24:
                freshness_bonus = 72
            elif hours_since_posted < 48:
                freshness_bonus = 48
            elif hours_since_posted < 72:
                freshness_bonus = max(0, 72 - hours_since_posted)
            else:
                freshness_bonus = 0
    
    # Random boost for variety (0-25 points)
    # This ensures feed changes on every refresh
    random_boost = random.uniform(0, 25)
    
    # Final score
    final_score = base_score + freshness_bonus + random_boost
    
    return {
        "final_score": final_score,
        "base_score": base_score,
        "freshness_bonus": freshness_bonus,
        "random_boost": random_boost,
        "hours_since_posted": hours_since_posted
    }


def get_diverse_explore_posts(posts, current_time, limit=20):
    """
    Get diverse explore posts using 70/30 split:
    - 70% top performing posts (by score)
    - 30% random posts (for discovery of new content)
    
    Also ensures creator diversity (max 2 posts per user in results)
    """
    if not posts:
        return []
    
    # Calculate scores for all posts
    scored_posts = []
    for post in posts:
        score_data = calculate_explore_score(post, current_time)
        scored_posts.append({
            "post": post,
            **score_data
        })
    
    # Sort by final_score (descending)
    scored_posts.sort(key=lambda x: x["final_score"], reverse=True)
    
    # Split into top performers and random pool
    top_count = int(limit * 0.7)  # 70% top performers
    random_count = limit - top_count  # 30% random
    
    # Get top performers with creator diversity
    top_posts = []
    user_post_count = {}
    max_posts_per_user = 2  # Limit posts per creator for diversity
    
    for item in scored_posts:
        user_id = item["post"].get("user_id")
        
        # Enforce creator diversity - skip if user already has max posts
        if user_post_count.get(user_id, 0) >= max_posts_per_user:
            continue
        
        top_posts.append(item)
        user_post_count[user_id] = user_post_count.get(user_id, 0) + 1
        
        if len(top_posts) >= top_count:
            break
    
    # Get random posts from remaining (excluding already selected)
    selected_ids = {str(p["post"]["_id"]) for p in top_posts}
    remaining_posts = [p for p in scored_posts if str(p["post"]["_id"]) not in selected_ids]
    
    # Randomly select from remaining posts for the 30% discovery portion
    if remaining_posts and random_count > 0:
        random_selection = random.sample(
            remaining_posts, 
            min(random_count, len(remaining_posts))
        )
    else:
        random_selection = []
    
    # Combine top posts and random selection
    final_posts = top_posts + random_selection
    
    # Shuffle the top 10 positions for perceived freshness on each refresh
    if len(final_posts) > 10:
        top_10 = final_posts[:10]
        rest = final_posts[10:]
        random.shuffle(top_10)
        final_posts = top_10 + rest
    else:
        random.shuffle(final_posts)
    
    return final_posts


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

# Create uploads directory if missing
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# ======================================================
# CUSTOM VIDEO ENDPOINT FOR iOS COMPATIBILITY
# iOS requires proper headers and range request support
# This route must be defined BEFORE the static mount
# ======================================================
from fastapi.responses import FileResponse, Response
from fastapi import Request, HTTPException
import mimetypes

@app.get("/api/static/uploads/{filename:path}")
async def serve_media_file(filename: str, request: Request):
    """
    Serve media files (images/videos) with proper headers for iOS compatibility.
    Supports range requests for video streaming on iOS.
    """
    import os
    from pathlib import Path
    
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type, _ = mimetypes.guess_type(file_path)
    if not content_type:
        # Default based on extension
        ext = os.path.splitext(filename)[1].lower()
        if ext in ['.mp4', '.mov', '.m4v']:
            content_type = 'video/mp4'
        elif ext in ['.jpg', '.jpeg']:
            content_type = 'image/jpeg'
        elif ext == '.png':
            content_type = 'image/png'
        else:
            content_type = 'application/octet-stream'
    
    # Check if it's a video file
    is_video = content_type.startswith('video/')
    
    # For video files, support range requests (required for iOS)
    if is_video:
        file_size = os.path.getsize(file_path)
        range_header = request.headers.get('range')
        
        if range_header:
            # Parse range header
            try:
                range_match = range_header.replace('bytes=', '').split('-')
                start = int(range_match[0]) if range_match[0] else 0
                end = int(range_match[1]) if range_match[1] else file_size - 1
                
                # Ensure valid range
                start = max(0, start)
                end = min(file_size - 1, end)
                content_length = end - start + 1
                
                # Read file chunk
                with open(file_path, 'rb') as f:
                    f.seek(start)
                    chunk = f.read(content_length)
                
                # Return partial content response
                return Response(
                    content=chunk,
                    status_code=206,  # Partial Content
                    headers={
                        'Content-Type': content_type,
                        'Content-Range': f'bytes {start}-{end}/{file_size}',
                        'Accept-Ranges': 'bytes',
                        'Content-Length': str(content_length),
                        'Cache-Control': 'public, max-age=31536000',
                    }
                )
            except (ValueError, IndexError, IOError) as e:
                # If range parsing fails, return full file
                print(f"Error parsing range header: {e}")
                return FileResponse(
                    file_path,
                    media_type=content_type,
                    headers={
                        'Accept-Ranges': 'bytes',
                        'Cache-Control': 'public, max-age=31536000',
                    }
                )
        else:
            # Full file response for videos
            return FileResponse(
                file_path,
                media_type=content_type,
                headers={
                    'Accept-Ranges': 'bytes',
                    'Cache-Control': 'public, max-age=31536000',
                }
            )
    else:
        # For images, use standard FileResponse
        return FileResponse(
            file_path,
            media_type=content_type,
            headers={
                'Cache-Control': 'public, max-age=31536000',
            }
        )

# Mount static files correctly (after custom route)
app.mount("/api/static", StaticFiles(directory=STATIC_DIR), name="static")

# Create uploads directory if missing
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs("static/uploads/restaurants", exist_ok=True)

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
app.include_router(restaurant_auth.router)
app.include_router(notifications_router)
app.include_router(follow_router)
app.include_router(profile_picture_router)
app.include_router(stories_router)
app.include_router(locations_router)
app.include_router(chat_router)
app.include_router(compliments_router)
app.include_router(moderation_router)
app.include_router(leaderboard_router)
app.include_router(restaurant_posts.router)


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
# LOCATION SUGGESTIONS (for fuzzy matching)
# ======================================================

@app.get("/api/locations/suggestions")
async def get_location_suggestions_endpoint(
    q: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """
    Get location suggestions based on user input (fuzzy matching).
    Used for "Did you mean?" feature when typing location.
    """
    if not q or len(q.strip()) < 2:
        return []
    
    db = get_database()
    
    # Get all unique locations from posts
    pipeline = [
        {"$match": {"location_name": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$location_name",
            "count": {"$sum": 1},
            "latest_map_link": {"$last": "$map_link"}
        }},
        {"$project": {
            "location_name": "$_id",
            "post_count": "$count",
            "map_link": "$latest_map_link",
            "_id": 0
        }}
    ]
    
    existing_locations_cursor = db.posts.aggregate(pipeline)
    existing_locations = await existing_locations_cursor.to_list(None)
    
    # Add normalized names
    for loc in existing_locations:
        loc['normalized_name'] = normalize_location_name(loc['location_name'])
    
    # Get suggestions using fuzzy matching
    suggestions = get_location_suggestions(q.strip(), existing_locations, limit)
    
    return suggestions


@app.get("/api/locations/check-duplicate")
async def check_location_duplicate(
    location_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a similar location already exists.
    Returns the matching location if found (80%+ similarity).
    """
    if not location_name or len(location_name.strip()) < 2:
        return {"match_found": False, "suggestion": None}
    
    db = get_database()
    
    # Get all unique locations from posts
    pipeline = [
        {"$match": {"location_name": {"$exists": True, "$ne": None, "$ne": ""}}},
        {"$group": {
            "_id": "$location_name",
            "count": {"$sum": 1},
            "latest_map_link": {"$last": "$map_link"}
        }},
        {"$project": {
            "location_name": "$_id",
            "post_count": "$count",
            "map_link": "$latest_map_link",
            "_id": 0
        }}
    ]
    
    existing_locations_cursor = db.posts.aggregate(pipeline)
    existing_locations = await existing_locations_cursor.to_list(None)
    
    # Add normalized names
    for loc in existing_locations:
        loc['normalized_name'] = normalize_location_name(loc['location_name'])
    
    # Find similar location
    match = find_similar_location(location_name.strip(), existing_locations, threshold=80)
    
    if match:
        return {
            "match_found": True,
            "suggestion": {
                "location_name": match['location_name'],
                "post_count": match['post_count'],
                "map_link": match.get('map_link'),
                "similarity_score": match['similarity_score']
            }
        }
    
    return {"match_found": False, "suggestion": None}

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
    tagged_restaurant_id: str = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    
    # Debug logging for category
    print(f"📝 Creating post with category: '{category}' (type: {type(category)})")
    if category:
        print(f"📝 Category after strip: '{category.strip()}')")

    # Get file extension
    file_ext = file.filename.split(".")[-1].lower()
    
    # Debug: Log the file extension
    print(f"📁 Uploaded file: {file.filename}, extension: {file_ext}")
    
    # Define allowed extensions (including iOS formats)
    ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "m4v"]
    ALL_ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS + ALLOWED_VIDEO_EXTENSIONS
    
    if file_ext not in ALL_ALLOWED_EXTENSIONS:
        print(f"❌ Invalid file type: {file_ext}")
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file_ext}. Allowed: {ALL_ALLOWED_EXTENSIONS}")

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
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # ======================================================
    # HEIC/HEIF CONVERSION - Convert iOS photos to JPEG
    # ======================================================
    if file_ext in ["heic", "heif"]:
        print(f"📱 iOS HEIC/HEIF detected - converting to JPEG...")
        try:
            from PIL import Image
            import pillow_heif
            
            # Register HEIF opener with Pillow
            pillow_heif.register_heif_opener()
            
            # Open HEIC and convert to JPEG
            img = Image.open(file_path)
            
            # Convert to RGB if necessary (HEIC can have alpha channel)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Create new filename with .jpg extension
            new_filename = f"{unique_id}_{os.path.splitext(file.filename)[0]}.jpg"
            new_file_path = os.path.join(settings.UPLOAD_DIR, new_filename)
            
            # Save as JPEG with good quality
            img.save(new_file_path, 'JPEG', quality=90, optimize=True)
            img.close()
            
            # Remove original HEIC file
            os.remove(file_path)
            
            # Update variables to point to new file
            file_path = new_file_path
            filename = new_filename
            file_ext = "jpg"
            
            print(f"✅ Converted HEIC to JPEG: {new_filename}")
        except ImportError:
            print("❌ pillow-heif not installed. Install with: pip install pillow-heif")
            os.remove(file_path)
            raise HTTPException(
                status_code=500, 
                detail="HEIC conversion not available. Please convert your photo to JPEG before uploading."
            )
        except Exception as e:
            print(f"❌ HEIC conversion failed: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to convert HEIC image: {str(e)}"
            )

    # Detect media type
    media_type = "video" if file_ext in ["mp4", "mov", "m4v"] else "image"
    


    # ======================================================
    # VIDEO OPTIMIZATION - Transcode to 720p H.264 and generate thumbnail
    # Handles both iOS MOV files and Android MP4 files
    # ======================================================
    thumbnail_url = None
    if media_type == "video":
        from utils.video_transcode import should_transcode_video, optimize_video_with_thumbnail
        
        video_source = "iOS MOV" if file_ext == "mov" else "Android/Other MP4"
        print(f"🎬 Video detected ({video_source}) - converting/optimizing to 720p H.264 MP4 and generating thumbnail...")
        
        try:
            # Always optimize video to 720p and generate thumbnail
            # This converts iOS MOV to MP4 and re-encodes Android MP4 for compatibility
            video_path, thumbnail_path = await optimize_video_with_thumbnail(file_path)
            
            # Update file_path and filename to point to the optimized file
            file_path = video_path
            filename = os.path.basename(video_path)
            
            # Generate thumbnail URL
            thumbnail_filename = os.path.basename(thumbnail_path)
            thumbnail_url = f"/api/static/uploads/{thumbnail_filename}"
            
            print(f"✅ Video converted/optimized to 720p MP4: {filename}")
            print(f"✅ Thumbnail generated: {thumbnail_filename}")
        except Exception as e:
            print(f"❌ Video optimization failed: {str(e)}")
            import traceback
            traceback.print_exc()
            # Don't continue with original file - fail the upload
            # This ensures all videos are properly formatted
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(
                status_code=500,
                detail=f"Video processing failed. Please ensure your video is in a supported format (MP4 or MOV). Error: {str(e)}"
            )

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
    # LOCATION NAME NORMALIZATION (prevent duplicates)
    # ======================================================
    final_location_name = None
    normalized_location = None
    
    if location_name and location_name.strip():
        final_location_name = location_name.strip()
        
        # Get existing locations for matching
        pipeline = [
            {"$match": {"location_name": {"$exists": True, "$ne": None, "$ne": ""}}},
            {"$group": {
                "_id": "$location_name",
                "count": {"$sum": 1}
            }},
            {"$project": {
                "location_name": "$_id",
                "_id": 0
            }}
        ]
        
        existing_locations_cursor = db.posts.aggregate(pipeline)
        existing_locations = await existing_locations_cursor.to_list(None)
        
        # Add normalized names
        for loc in existing_locations:
            loc['normalized_name'] = normalize_location_name(loc['location_name'])
        
        # Check for similar existing location
        match = find_similar_location(final_location_name, existing_locations, threshold=80)
        
        if match:
            # Use existing location name (canonical version)
            final_location_name = match['location_name']
            print(f"📍 Location matched: '{location_name.strip()}' → '{final_location_name}' ({match.get('similarity_score', 0)}% similar)")
        
        normalized_location = normalize_location_name(final_location_name)

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
        "location_name": final_location_name, 
        "normalized_location_name": normalized_location,
        "category": category.strip() if category else None,  # Add category
        "tagged_restaurant_id": tagged_restaurant_id if tagged_restaurant_id else None,  # ← ADD THIS LINE
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
# ENGAGEMENT SCORE CALCULATION (Instagram-like algorithm)
# ======================================================
def calculate_engagement_score(post, current_time):
    """
    Calculate engagement score based on likes, comments, and recency.
    Higher score = more likely to appear at top.
    
    Formula:
    - Likes weight: 1.0 per like
    - Comments weight: 2.0 per comment (comments are more valuable)
    - Recency decay: exponential decay over time (posts from last 24h get full boost)
    - Base score: 1.0 (so new posts with 0 engagement still have a chance)
    """
    import math
    
    likes_count = post.get("likes_count", 0)
    comments_count = post.get("comments_count", 0)
    created_at = post.get("created_at")
    
    # Engagement from interactions
    engagement_score = (likes_count * 1.0) + (comments_count * 2.0)
    
    # Recency factor (decay over time)
    if created_at and isinstance(created_at, datetime):
        time_diff = (current_time - created_at).total_seconds() / 3600  # Hours since creation
        
        # Exponential decay: 
        # - Posts < 24h old: full weight (1.0)
        # - Posts 1-7 days old: 0.7x weight
        # - Posts 7-30 days old: 0.5x weight  
        # - Posts > 30 days old: 0.3x weight
        if time_diff < 24:
            recency_factor = 1.0
        elif time_diff < 168:  # 7 days
            recency_factor = 0.7
        elif time_diff < 720:  # 30 days
            recency_factor = 0.5
        else:
            recency_factor = 0.3
        
        # Apply recency factor to engagement
        engagement_score *= recency_factor
        
        # Add small recency boost (newer posts get small advantage even with 0 engagement)
        recency_boost = max(0, (24 - time_diff) / 24) * 0.5  # Max 0.5 boost for posts < 24h
        engagement_score += recency_boost
    else:
        # If no created_at, use base score only
        recency_factor = 0.5
        engagement_score *= recency_factor
    
    # Add base score so posts with 0 engagement still have a chance
    final_score = engagement_score + 1.0
    
    return final_score


# ======================================================
# FEED
# ======================================================
# ======================================================
# FEED (MIXED - Users + Restaurants)
# ======================================================
@app.get("/api/feed")
async def get_feed(
    skip: int = 0, 
    limit: int = None, 
    category: str = None, 
    categories: str = None,
    sort: str = "engagement",
    current_user: dict = Depends(get_current_user)
):
    """
    Get feed posts from both users and restaurants.
    """
    db = get_database()
    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)
    
    # Build query for user posts
    user_query = {}
    if blocked_user_ids:
        user_query["user_id"] = {"$nin": blocked_user_ids}

    import re

    # Handle category filtering
    if categories and categories.strip():
        category_list = [cat.strip() for cat in categories.split(",") if cat.strip() and cat.strip().lower() != 'all']
        if category_list:
            regex_patterns = [{"category": {"$regex": re.escape(cat), "$options": "i"}} for cat in category_list]
            if "user_id" in user_query:
                user_query["$and"] = [{"user_id": user_query["user_id"]}, {"$or": regex_patterns}]
                del user_query["user_id"]
            else:
                user_query["$or"] = regex_patterns
    elif category and category.strip() and category.lower() != 'all':
        category_clean = category.strip()
        category_escaped = re.escape(category_clean)
        user_query["category"] = {"$regex": f"^{category_escaped}$", "$options": "i"}

    # Build query for restaurant posts (same category filter)
    restaurant_query = {}
    if categories and categories.strip():
        category_list = [cat.strip() for cat in categories.split(",") if cat.strip() and cat.strip().lower() != 'all']
        if category_list:
            regex_patterns = [{"category": {"$regex": re.escape(cat), "$options": "i"}} for cat in category_list]
            restaurant_query["$or"] = regex_patterns
    elif category and category.strip() and category.lower() != 'all':
        category_clean = category.strip()
        category_escaped = re.escape(category_clean)
        restaurant_query["category"] = {"$regex": f"^{category_escaped}$", "$options": "i"}

    current_time = datetime.utcnow()
    
    # Fetch from both collections
    if sort == "engagement":
        fetch_limit = min((limit or 30) * 3, 300)
        
        # Fetch user posts
        user_posts_raw = await db.posts.find(user_query).sort("created_at", -1).limit(fetch_limit).to_list(fetch_limit)
        
        # Fetch restaurant posts
        restaurant_posts_raw = await db.restaurant_posts.find(restaurant_query).sort("created_at", -1).limit(fetch_limit).to_list(fetch_limit)
        
        # Add source identifier
        for post in user_posts_raw:
            post["_source"] = "user"
        for post in restaurant_posts_raw:
            post["_source"] = "restaurant"
        
        # Combine all posts
        all_posts = user_posts_raw + restaurant_posts_raw
        
        # Calculate engagement scores
        posts_with_scores = []
        for post in all_posts:
            score = calculate_engagement_score(post, current_time)
            posts_with_scores.append((post, score))
        
        # Sort by engagement score
        posts_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Shuffle similar scores for variety
        shuffled_posts_with_scores = []
        if len(posts_with_scores) > 1:
            i = 0
            while i < len(posts_with_scores):
                current_post, current_score = posts_with_scores[i]
                similar_group = [(current_post, current_score)]
                j = i + 1
                while j < len(posts_with_scores):
                    next_post, next_score = posts_with_scores[j]
                    if abs(next_score - current_score) / max(current_score, 1) <= 0.1:
                        similar_group.append((next_post, next_score))
                        j += 1
                    else:
                        break
                random.shuffle(similar_group)
                shuffled_posts_with_scores.extend(similar_group)
                i = j
        else:
            shuffled_posts_with_scores = posts_with_scores
        
        posts = [p[0] for p in shuffled_posts_with_scores]
        posts = posts[skip:]
        if limit:
            posts = posts[:limit]
    else:
        # Chronological sorting
        if limit is None:
            user_posts_raw = await db.posts.find(user_query).sort("created_at", -1).skip(skip).to_list(None)
            restaurant_posts_raw = await db.restaurant_posts.find(restaurant_query).sort("created_at", -1).skip(skip).to_list(None)
        else:
            user_posts_raw = await db.posts.find(user_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
            restaurant_posts_raw = await db.restaurant_posts.find(restaurant_query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Add source identifier
        for post in user_posts_raw:
            post["_source"] = "user"
        for post in restaurant_posts_raw:
            post["_source"] = "restaurant"
        
        # Combine and sort by created_at
        all_posts = user_posts_raw + restaurant_posts_raw
        all_posts.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
        
        # Apply limit after combining
        if limit:
            posts = all_posts[:limit]
        else:
            posts = all_posts

    print(f"📊 Mixed feed: {len(posts)} posts (users + restaurants)")

    # Build result
    result = []
    for post in posts:
        post_id = str(post["_id"])
        is_restaurant_post = post.get("_source") == "restaurant"
        
        if is_restaurant_post:
            # Restaurant post
            restaurant_id = post.get("restaurant_id")
            restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)}) if restaurant_id else None
            
            is_liked = await db.restaurant_likes.find_one({
                "post_id": post_id,
                "restaurant_id": str(current_user["_id"])
            }) is not None
            
            is_saved = await db.restaurant_saved_posts.find_one({
                "post_id": post_id,
                "restaurant_id": str(current_user["_id"])
            }) is not None
            
            result.append({
                "id": post_id,
                "user_id": restaurant_id,
                "username": post.get("restaurant_name") or (restaurant["restaurant_name"] if restaurant else "Unknown"),
                "user_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                "user_level": None,  # Restaurants don't have levels
                "media_url": post.get("media_url", ""),
                "image_url": post.get("image_url"),
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "rating": None,  # Restaurants use price instead
                "price": post.get("price", ""),
                "review_text": post.get("about", ""),
                "about": post.get("about", ""),
                "description": post.get("about", ""),
                "map_link": post.get("map_link"),
                "location_name": post.get("location_name"),
                "category": post.get("category"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "is_following": False,
                "account_type": "restaurant",
                "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
            })
        else:
            # User post
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

            is_following = await db.follows.find_one({
                "followerId": str(current_user["_id"]),
                "followingId": user_id
            }) is not None

            media_url = post.get("media_url", "")
            media_type = post.get("media_type", "image")
            image_url = post.get("image_url") if media_type == "image" else None

            result.append({
                "id": post_id,
                "user_id": user_id,
                "username": user["full_name"] if user else "Unknown",
                "user_profile_picture": user.get("profile_picture") if user else None,
                "user_badge": user.get("badge") if user else None,
                "user_level": user.get("level", 1),
                "media_url": media_url,
                "image_url": image_url,
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": media_type,
                "rating": post.get("rating", 0),
                "price": None,  # Users use rating instead
                "review_text": post.get("review_text", ""),
                "description": post.get("review_text", ""),
                "map_link": post.get("map_link"),
                "location_name": post.get("location_name"),
                "category": post.get("category"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "is_following": is_following,
                "account_type": "user",
                "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
            })

    return result

# ==================== LAST 3 DAYS POSTS ENDPOINT ====================

@app.get("/api/posts/last-3-days")
async def get_last_3_days_posts(current_user: dict = Depends(get_current_user)):
    """Get posts from the last 3 days"""
    db = get_database()

    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)
    
    # Calculate the date 3 days ago
    three_days_ago = datetime.utcnow() - timedelta(days=3)


     # ✅ MODIFY THIS: Query posts created in the last 3 days, excluding blocked users
    query = {"created_at": {"$gte": three_days_ago}}
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}
    
    # Query posts created in the last 3 days
    posts = await db.posts.find({
        "created_at": {"$gte": three_days_ago}
    }).sort("created_at", -1).to_list(None)
    
    print(f"📊 Found {len(posts)} posts from the last 3 days")
    
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
            "followerId": str(current_user["_id"]),
            "followingId": user_id
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
    """
    Get trending posts with improved algorithm:
    - 70% top performing posts (by engagement + freshness)
    - 30% random posts (for discovery)
    - Creator diversity (max 2 posts per user)
    - Random rotation on each refresh
    """
    db = get_database()
    current_time = datetime.utcnow()


    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)
    
    # Fetch more posts than needed for better selection pool
    # Get posts from last 30 days for trending
    thirty_days_ago = current_time - timedelta(days=30)

    # ✅ MODIFY THIS: Exclude blocked users
    query = {"created_at": {"$gte": thirty_days_ago}}
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}
    
    all_posts = await db.posts.find({
        "created_at": {"$gte": thirty_days_ago}
    }).to_list(500)
    
    # If not enough recent posts, include older ones
    if len(all_posts) < 50:
        all_posts = await db.posts.find().sort("created_at", -1).to_list(500)
    
    print(f"📊 Explore/Trending: Found {len(all_posts)} posts in pool")
    
    # Apply diverse explore algorithm
    diverse_posts = get_diverse_explore_posts(all_posts, current_time, limit=skip + limit + 20)
    
    # Apply pagination
    paginated = diverse_posts[skip:skip + limit]
    
    result = []
    for item in paginated:
        post = item["post"]
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
            "user_badge": user.get("badge") if user else None,
            "user_level": user.get("level", 1) if user else 1,
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
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    print(f"✅ Explore/Trending: Returned {len(result)} posts with diversity algorithm")
    return result


# ----------------------------------------------
# REPLACE: /api/explore/top-rated
# ----------------------------------------------
@app.get("/api/explore/top-rated")
async def get_top_rated_posts(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get top-rated posts (rating >= 8) with freshness and randomness"""
    db = get_database()
    current_time = datetime.utcnow()

    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)

    # ✅ MODIFY THIS: Get high-rated posts excluding blocked users
    query = {"rating": {"$gte": 8}}
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}
    
    # Get high-rated posts
    posts = await db.posts.find({"rating": {"$gte": 8}}).to_list(300)
    
    print(f"📊 Explore/TopRated: Found {len(posts)} posts with rating >= 8")
    
    # Apply diverse algorithm
    diverse_posts = get_diverse_explore_posts(posts, current_time, limit=skip + limit + 20)
    paginated = diverse_posts[skip:skip + limit]
    
    result = []
    for item in paginated:
        post = item["post"]
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
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
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
    """
    Main Explore endpoint with full diversity algorithm:
    - 70/30 top/random split
    - Freshness boost for new posts
    - Random rotation on refresh
    - Creator diversity
    """
    db = get_database()
    current_time = datetime.utcnow()

    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)

     # ✅ MODIFY THIS: Get all posts excluding blocked users
    query = {}
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}
    
    # Get all posts (limit to reasonable pool for performance)
    all_posts = await db.posts.find().sort("created_at", -1).limit(1000).to_list(1000)
    
    print(f"📊 Explore/All: Found {len(all_posts)} posts in pool")
    
    # Apply diverse explore algorithm
    diverse_posts = get_diverse_explore_posts(all_posts, current_time, limit=skip + limit + 30)
    paginated = diverse_posts[skip:skip + limit]
    
    result = []
    for item in paginated:
        post = item["post"]
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
            "user_badge": user.get("badge") if user else None,
            "user_level": user.get("level", 1) if user else 1,
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
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    print(f"✅ Explore/All: Returned {len(result)} posts with diversity algorithm")
    return result


# ----------------------------------------------
# REPLACE: /api/explore/category
# ----------------------------------------------
@app.get("/api/explore/category")
async def get_posts_by_category(name: str, skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get posts filtered by category with diversity algorithm"""
    db = get_database()
    current_time = datetime.utcnow()

    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)

    # ✅ MODIFY THIS: Search in both category field and review_text, excluding blocked users
    query = {
        "$or": [
            {"category": {"$regex": name, "$options": "i"}},
            {"review_text": {"$regex": name, "$options": "i"}}
        ]
    }
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}
    
    # Search in both category field and review_text
    posts = await db.posts.find({
        "$or": [
            {"category": {"$regex": name, "$options": "i"}},
            {"review_text": {"$regex": name, "$options": "i"}}
        ]
    }).to_list(300)
    
    print(f"📊 Explore/Category '{name}': Found {len(posts)} posts")
    
    # Apply diverse algorithm
    diverse_posts = get_diverse_explore_posts(posts, current_time, limit=skip + limit + 20)
    paginated = diverse_posts[skip:skip + limit]
    
    result = []
    for item in paginated:
        post = item["post"]
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
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
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
    """
    if not q or not q.strip():
        return []
    
    db = get_database()
    query = q.strip().lower()
    
    # ✅ ADD THIS: Get blocked user IDs
    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)
    
    # Build MongoDB query to search across multiple fields
    search_regex = {"$regex": query, "$options": "i"}  # ✅ FIXED: Use 'query' instead of 'query_text'
    
    # ✅ MODIFY THIS: Exclude blocked users from search
    search_query = {
        "$or": [
            {"review_text": search_regex},
            {"location_name": search_regex},
        ]
    }
    if blocked_user_ids:
        search_query["user_id"] = {"$nin": blocked_user_ids}
    
    # Get all posts that match the search query
    all_posts = await db.posts.find(search_query).to_list(None)  # ✅ FIXED: Use search_query
    
    # Also search by username
    users_matching = await db.users.find({
        "full_name": search_regex
    }).to_list(None)
    
    user_ids_matching = [str(u["_id"]) for u in users_matching]
    
    # Get posts from matching users (excluding blocked users)
    posts_by_users_query = {"user_id": {"$in": user_ids_matching}}
    if blocked_user_ids:
        posts_by_users_query["user_id"] = {"$in": [uid for uid in user_ids_matching if uid not in blocked_user_ids]}
    
    posts_by_users = await db.posts.find(posts_by_users_query).to_list(None)
    
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

@app.get("/api/restaurants/search")
async def search_restaurants_for_tagging(
    q: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """Search restaurants by name for tagging in user posts"""
    db = get_database()
    
    if not q or len(q.strip()) < 2:
        return []
    
    import re
    search_query = {
        "restaurant_name": {"$regex": re.escape(q.strip()), "$options": "i"}
    }
    
    restaurants = await db.restaurants.find(search_query).limit(limit).to_list(limit)
    
    result = []
    for restaurant in restaurants:
        result.append({
            "id": str(restaurant["_id"]),
            "restaurant_name": restaurant.get("restaurant_name", ""),
            "profile_picture": restaurant.get("profile_picture"),
            "bio": restaurant.get("bio", ""),
            "is_verified": restaurant.get("is_verified", False),
        })
    
    return result

@app.get("/api/restaurants/{restaurant_id}/reviews")
async def get_restaurant_reviews(
    restaurant_id: str,
    skip: int = 0,
    limit: int = 50
):
    """Get all user posts that tagged this restaurant (reviews)"""
    db = get_database()
    
    # Verify restaurant exists
    try:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Find all posts that tagged this restaurant
    posts = await db.posts.find({
        "tagged_restaurant_id": restaurant_id
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        # Get user info
        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        
        result.append({
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user.get("full_name") or user.get("username") if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "user_level": user.get("level", 1) if user else 1,
            "media_url": post.get("media_url") or post.get("image_url", ""),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "rating": post.get("rating"),
            "review_text": post.get("review_text", ""),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
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
        "followerId": str(current_user["_id"]),
        "followingId": user_id
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    # Add follow
    await db.follows.insert_one({
        "followerId": str(current_user["_id"]),
        "followingId": user_id,
        "createdAt": datetime.utcnow()
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
        "followerId": str(current_user["_id"]),
        "followingId": user_id
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
    
    follows = await db.follows.find({"followerId": user_id}).to_list(100)
    
    result = []
    for follow in follows:
        user = await db.users.find_one({"_id": ObjectId(follow["followingId"])})
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


# ==================== BANNER IMAGE ENDPOINTS ====================

@app.post("/api/users/upload-banner-image")
async def upload_banner_image(
    file: UploadFile = File(...),
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login"))
):
    """Upload banner/cover image - Works for both restaurant and regular users"""
    from utils.jwt import verify_token
    import jwt
    
    db = get_database()
    
    # Decode token to check account type
    try:
        # First verify the token is valid
        email = verify_token(token)
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Decode to get account_type (without verification since we already verified)
        payload = jwt.decode(token, options={"verify_signature": False})
        account_type = payload.get("account_type", "user")
    except Exception as e:
        print(f"❌ Token decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get the current account based on type
    if account_type == "restaurant":
        current_account = await db.restaurants.find_one({"email": email})
        collection = db.restaurants
        upload_dir = os.path.join(settings.UPLOAD_DIR, "restaurants")
        url_prefix = "/api/static/uploads/restaurants"
    else:
        current_account = await db.users.find_one({"email": email})
        collection = db.users
        upload_dir = settings.UPLOAD_DIR
        url_prefix = "/api/static/uploads"
    
    if not current_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Ensure upload directory exists
    os.makedirs(upload_dir, exist_ok=True)
    
    # Validate file type
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed."
        )
    
    # Generate unique filename
    unique_id = str(ObjectId())
    filename = f"banner_{str(current_account['_id'])}_{unique_id}.{file_ext}"
    file_path = os.path.join(upload_dir, filename)
    
    # Delete old banner image if exists
    old_banner = current_account.get("cover_image")
    if old_banner:
        old_filename = None
        if f"{url_prefix}/" in old_banner:
            old_filename = old_banner.split(f"{url_prefix}/")[-1]
        
        if old_filename:
            old_path = os.path.join(upload_dir, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"🗑️ Deleted old banner image: {old_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete old banner image: {e}")
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"✅ Banner image saved: {file_path}")
    except Exception as e:
        print(f"❌ Error saving banner image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Calculate URL
    cover_image_url = f"{url_prefix}/{filename}"
    
    # Update account
    await collection.update_one(
        {"_id": current_account["_id"]},
        {"$set": {"cover_image": cover_image_url}}
    )
    
    print(f"✅ Banner image updated for {account_type} {current_account['_id']}: {cover_image_url}")
    
    return {
        "message": "Banner image uploaded successfully",
        "cover_image": cover_image_url,
        "banner_image": cover_image_url,
        "cover_image_url": cover_image_url
    }


@app.delete("/api/users/banner-image")
async def delete_banner_image(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login"))
):
    """Remove banner/cover image - Works for both restaurant and regular users"""
    from utils.jwt import verify_token
    import jwt
    
    db = get_database()
    
    # Decode token to check account type
    try:
        email = verify_token(token)
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        payload = jwt.decode(token, options={"verify_signature": False})
        account_type = payload.get("account_type", "user")
    except Exception as e:
        print(f"❌ Token decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get the current account based on type
    if account_type == "restaurant":
        current_account = await db.restaurants.find_one({"email": email})
        collection = db.restaurants
        upload_dir = os.path.join(settings.UPLOAD_DIR, "restaurants")
        url_prefix = "/api/static/uploads/restaurants"
    else:
        current_account = await db.users.find_one({"email": email})
        collection = db.users
        upload_dir = settings.UPLOAD_DIR
        url_prefix = "/api/static/uploads"
    
    if not current_account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Get current banner
    old_banner = current_account.get("cover_image")
    
    # Delete file if exists
    if old_banner:
        old_filename = None
        if f"{url_prefix}/" in old_banner:
            old_filename = old_banner.split(f"{url_prefix}/")[-1]
        
        if old_filename:
            old_path = os.path.join(upload_dir, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"🗑️ Deleted banner image: {old_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete banner image: {e}")
    
    # Clear cover_image in database
    await collection.update_one(
        {"_id": current_account["_id"]},
        {"$set": {"cover_image": None}}
    )
    
    print(f"✅ Banner image removed for {account_type} {current_account['_id']}")
    
    return {"message": "Banner image removed successfully"}


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
            "followerId": current_user_id,
            "followingId": post["user_id"]
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

# Debug endpoint for checking data
from routers import check_data
app.include_router(check_data.router)

# ==================== BLOCK USER ENDPOINTS ====================

@app.post("/api/users/{user_id}/block")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user - they will be hidden from all feeds"""
    db = get_database()
    
    if user_id == str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    # Check if already blocked
    existing_block = await db.blocks.find_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id
    })
    
    if existing_block:
        raise HTTPException(status_code=400, detail="User is already blocked")
    
    # Add block
    await db.blocks.insert_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "User blocked successfully"}

@app.delete("/api/users/{user_id}/block")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a user - they will appear in feeds again"""
    db = get_database()
    
    result = await db.blocks.delete_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="User is not blocked")
    
    return {"message": "User unblocked successfully"}

@app.get("/api/users/blocked-list")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """Get list of blocked users"""
    db = get_database()
    
    # Get all blocks for current user
    blocks = await db.blocks.find({
        "blocker_id": str(current_user["_id"])
    }).to_list(None)
    
    result = []
    for block in blocks:
        user = await db.users.find_one({"_id": ObjectId(block["blocked_id"])})
        if user:
            result.append({
                "id": str(user["_id"]),
                "user_id": str(user["_id"]),
                "full_name": user.get("full_name", "Unknown"),
                "username": user.get("username") or user.get("full_name", "Unknown"),
                "profile_picture": user.get("profile_picture"),
                "level": user.get("level", 1),
                "blocked_at": block["created_at"]
            })
    
    return result

# Helper function to get blocked user IDs (use in other endpoints)
async def get_blocked_user_ids(current_user_id: str, db):
    """Get list of user IDs that current user has blocked"""
    blocks = await db.blocks.find({
        "blocker_id": current_user_id
    }).to_list(None)
    
    return [block["blocked_id"] for block in blocks]
