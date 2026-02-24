from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, status, Form, WebSocket, Request 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from bson import ObjectId
from bson.errors import InvalidId
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
from routers.leaderboard import router as leaderboard_router, calculate_engagement_score as lb_engagement_score, calculate_combined_score as lb_combined_score
from routers import restaurant_auth
from routers import restaurant_posts
from routers.restaurant_analytics import router as restaurant_analytics_router
from routers.map import router as map_router
from routers.grammar import router as grammar_router
from routers.wallet import router as wallet_router
from routers.user_profile import router as user_profile_router
from routers.places import router as places_router
from routers.orders import router as orders_router
from routers.menu import router as menu_router
from routers.admin_auth import router as admin_auth_router
from routers.badge_requests import router as badge_requests_router
from utils.wallet_system import calculate_wallet_reward, process_wallet_reward, WalletRewardResult

# Import utils
from utils.level_system import calculate_level, add_post_points, calculateUserLevelAfterPost, recalculate_points_from_post_count, get_points_for_level
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
from fastapi.responses import FileResponse, Response, JSONResponse
from fastapi import Request, HTTPException
import mimetypes
import json

# ======================================================
# UNIVERSAL LINKS & APP LINKS (Deep Linking)
# ======================================================
@app.get("/.well-known/apple-app-site-association")
async def apple_app_site_association():
    """Serves apple-app-site-association for iOS Universal Links"""
    aasa = {
        "applinks": {
            "apps": [],
            "details": [
                {
                    "appID": "FBN9A288DV.com.cofau.app",
                    "paths": ["/share/*"]
                }
            ]
        }
    }
    return Response(
        content=json.dumps(aasa),
        media_type="application/json"
    )

@app.get("/.well-known/assetlinks.json")
async def android_asset_links():
    """Serves assetlinks.json for Android App Links"""
    asset_links = [
        {
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": "com.cofau.app",
                "sha256_cert_fingerprints": [
                    "1D:DD:C9:56:6C:B1:53:82:C6:27:8A:FD:10:00:D2:60:1D:9B:39:89:35:10:E1:E2:15:E7:CE:59:33:E4:EB:24"
                ]
            }
        }
    ]
    return Response(
        content=json.dumps(asset_links),
        media_type="application/json"
    )

@app.get("/download")
async def download_redirect(request: Request):
    """Redirects to App Store or Play Store based on device"""
    from fastapi.responses import RedirectResponse
    user_agent = request.headers.get("user-agent", "").lower()

    APP_STORE_URL = "https://apps.apple.com/app/cofau/id6758019920"
    PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.cofau.app"

    if any(x in user_agent for x in ["iphone", "ipad", "ipod", "macintosh"]):
        return RedirectResponse(url=APP_STORE_URL)
    elif "android" in user_agent:
        return RedirectResponse(url=PLAY_STORE_URL)
    else:
        # Desktop or unknown — show a page with both links
        html = """<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Download Cofau</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8f9fa; display:flex; justify-content:center; align-items:center; min-height:100vh;">
            <div style="text-align:center; padding:40px 20px;">
                <div style="width:80px; height:80px; background:#4dd0e1; border-radius:20px; margin:0 auto 20px; display:flex; align-items:center; justify-content:center;">
                    <span style="font-size:40px; color:white; font-weight:bold; font-style:italic;">C</span>
                </div>
                <h1 style="color:#333; margin:0 0 8px;">Download Cofau</h1>
                <p style="color:#888; font-size:16px; margin:0 0 32px;">Discover and share amazing food experiences</p>
                <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">
                    <a href=\"""" + APP_STORE_URL + """\" style="display:inline-block; background:#000; color:white; text-decoration:none; padding:14px 28px; border-radius:12px; font-weight:600; font-size:16px;">App Store</a>
                    <a href=\"""" + PLAY_STORE_URL + """\" style="display:inline-block; background:#34a853; color:white; text-decoration:none; padding:14px 28px; border-radius:12px; font-weight:600; font-size:16px;">Google Play</a>
                </div>
            </div>
        </body>
        </html>"""
        return HTMLResponse(content=html)

@app.get("/api/static/uploads/{filename:path}")
async def serve_media_file(filename: str, request: Request, w: int = None):
    """
    Serve media files (images/videos) with proper headers for iOS compatibility.
    Supports range requests for video streaming on iOS.
    Optional ?w=300 parameter to serve resized images for thumbnails/grids.
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

    # If ?w= is provided and it's an image, serve a resized version
    if w and content_type and content_type.startswith('image/'):
        try:
            from PIL import Image as PILImage
            import io

            # Clamp width to reasonable range
            w = max(50, min(w, 1200))

            # Check for cached thumbnail
            name, ext = os.path.splitext(filename)
            thumb_filename = f"{name}_w{w}{ext}"
            thumb_path = os.path.join(settings.UPLOAD_DIR, thumb_filename)

            if os.path.exists(thumb_path):
                return FileResponse(
                    thumb_path,
                    media_type=content_type,
                    headers={'Cache-Control': 'public, max-age=31536000'},
                )

            # Generate resized image
            img = PILImage.open(file_path)
            if img.width > w:
                ratio = w / img.width
                new_height = int(img.height * ratio)
                img = img.resize((w, new_height), PILImage.LANCZOS)

            # Save cached thumbnail to disk
            if content_type == 'image/png':
                img.save(thumb_path, 'PNG', optimize=True)
            else:
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                img.save(thumb_path, 'JPEG', quality=80, optimize=True)

            return FileResponse(
                thumb_path,
                media_type=content_type,
                headers={'Cache-Control': 'public, max-age=31536000'},
            )
        except Exception as e:
            print(f"⚠️ Thumbnail generation failed, serving original: {e}")
            # Fall through to serve original

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
# PARTNER DASHBOARD - Serve at /orders
# ======================================================
PARTNER_DASHBOARD_DIR = os.path.join(BASE_DIR, "static", "partner-dashboard")
os.makedirs(PARTNER_DASHBOARD_DIR, exist_ok=True)

# ✅ Mount static assets for partner dashboard (CSS, JS, images)
try:
    app.mount("/orders/assets", StaticFiles(directory=os.path.join(PARTNER_DASHBOARD_DIR, "assets")), name="partner-assets")
    print(f"✅ Mounted partner dashboard assets at /orders/assets")
except Exception as e:
    print(f"⚠️ Could not mount partner dashboard assets: {e}")

# ✅ Serve partner dashboard SPA at /orders root only
# NOTE: No catch-all route needed - React Router handles all client-side routing
# The mount above will serve assets, and this route serves the HTML
@app.get("/orders", response_class=HTMLResponse)
async def serve_partner_dashboard_root():
    """Serve the partner dashboard SPA at /orders (React Router handles client-side routing)"""
    dashboard_index = os.path.join(PARTNER_DASHBOARD_DIR, "index.html")

    if os.path.exists(dashboard_index):
        return FileResponse(dashboard_index)
    else:
        return HTMLResponse(
            content="<h1>Partner Dashboard Not Found</h1><p>Please build the dashboard first.</p>",
            status_code=404
        )

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
app.include_router(map_router)
app.include_router(restaurant_analytics_router)
app.include_router(grammar_router)
app.include_router(wallet_router)
app.include_router(user_profile_router)
app.include_router(places_router)
app.include_router(orders_router)
app.include_router(menu_router)
app.include_router(admin_auth_router)
app.include_router(badge_requests_router)



# ======================================================
# ADMIN PORTAL - Serve at /admin
# ======================================================
ADMIN_PORTAL_DIR = os.path.join(BASE_DIR, "static", "admin-portal")
os.makedirs(ADMIN_PORTAL_DIR, exist_ok=True)

# Mount static assets for admin portal (CSS, JS, images)
try:
    app.mount("/admin/assets", StaticFiles(directory=os.path.join(ADMIN_PORTAL_DIR, "assets")), name="admin-assets")
    print(f"✅ Mounted admin portal assets at /admin/assets")
except Exception as e:
    print(f"⚠️ Could not mount admin portal assets: {e}")

@app.get("/admin", response_class=HTMLResponse)
async def serve_admin_portal_root():
    """Serve the admin portal SPA at /admin"""
    admin_index = os.path.join(ADMIN_PORTAL_DIR, "index.html")
    if os.path.exists(admin_index):
        return FileResponse(admin_index)
    else:
        return HTMLResponse(
            content="<h1>Admin Portal Not Found</h1><p>Please build the admin portal first.</p>",
            status_code=404
        )


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
    rating: float = Form(...),
    review_text: str = Form(...),
    map_link: str = Form(None),
    location_name: str = Form(None),
    category: str = Form(None),
    dish_name: str = Form(None),
    tagged_restaurant_id: str = Form(None),
    user_latitude: float = Form(None),
    user_longitude: float = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    
    print(f"🏷️ Received tagged_restaurant_id: {tagged_restaurant_id}")

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
    thumbnail_path = None
    if media_type == "video":
        from utils.video_transcode import should_transcode_video, optimize_video_with_thumbnail
        
        video_source = "iOS MOV" if file_ext == "mov" else "Android/Other MP4"
        print(f"🎬 Video detected ({video_source}) - converting/optimizing to 720p H.264 MP4 and generating thumbnail...")
        
        try:
            # Always optimize video to 720p and generate thumbnail
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
            print(f"🚫 BANNED CONTENT DETECTED - User: {current_user.get('full_name', 'Unknown')} (ID: {current_user['_id']})")
            print(f"   Reason: {moderation_response.reason}")
            print(f"   File: {file_path}")
            
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"✅ Banned file deleted from server: {file_path}")
                else:
                    print(f"⚠️ File not found (may have been deleted already): {file_path}")
            except Exception as e:
                print(f"❌ CRITICAL: Failed to delete banned file: {str(e)}")
                try:
                    os.remove(file_path)
                except:
                    pass
            
            if moderation_response.moderation_result:
                await save_moderation_result(
                    db=db,
                    moderation_result=moderation_response.moderation_result,
                    post_id=None
                )
            
            raise HTTPException(
                status_code=400,
                detail=f"Content not allowed: {moderation_response.reason or 'Banned content detected. Image contains nudity, alcohol, or other prohibited content.'}"
            )
        
        if moderation_response.moderation_result:
            moderation_result = moderation_response.moderation_result

    # ======================================================
    # CLEAN MAP LINK
    # ======================================================
    clean_map_link = None
    if map_link:
        map_link = map_link.strip()
        if not map_link.startswith("http"):
            map_link = "https://" + map_link
        if "google.com/maps" in map_link or "goo.gl/maps" in map_link or "maps.app" in map_link:
            clean_map_link = map_link

    # ======================================================
    # EXTRACT COORDINATES FROM MAP LINK
    # ======================================================
    latitude = None
    longitude = None

    if clean_map_link:
        try:
            from routers.map import get_coordinates_for_map_link
            coords = await get_coordinates_for_map_link(clean_map_link)
            if coords:
                latitude = coords.get("latitude")
                longitude = coords.get("longitude")
                print(f"📍 Coordinates extracted: {latitude}, {longitude}")
        except Exception as e:
            print(f"⚠️ Error extracting coordinates: {e}")

    # ======================================================
    # FIX MEDIA PATH
    # ======================================================
    final_filename = os.path.basename(file_path)
    media_url = f"/api/static/uploads/{final_filename}"
    
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
        
        for loc in existing_locations:
            loc['normalized_name'] = normalize_location_name(loc['location_name'])
        
        match = find_similar_location(final_location_name, existing_locations, threshold=80)
        
        if match:
            final_location_name = match['location_name']
            print(f"📍 Location matched: '{location_name.strip()}' → '{final_location_name}' ({match.get('similarity_score', 0)}% similar)")
        
        normalized_location = normalize_location_name(final_location_name)

    # ======================================================
    # QUALITY SCORING - Analyze media quality for leaderboard
    # ======================================================
    quality_score = 50.0
    try:
        from utils.sightengine_quality import analyze_media_quality
        quality_score = await analyze_media_quality(file_path, media_type, thumbnail_path=thumbnail_path)
        print(f"✅ Quality score calculated: {quality_score} for {file_path}")
    except Exception as e:
        print(f"⚠️ Quality scoring failed, using default: {str(e)}")
        quality_score = 50.0

    # ======================================================
    # CREATE POST DOCUMENT
    # ======================================================
    post_doc = {
        "user_id": str(current_user["_id"]),
        "media_url": media_url,
        "image_url": media_url if media_type == "image" else None,
        "thumbnail_url": thumbnail_url,
        "media_type": media_type,
        "rating": rating,
        "review_text": review_text,
        "map_link": clean_map_link,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": final_location_name,
        "normalized_location_name": normalized_location,
        "category": category.strip() if category else None,
        "dish_name": dish_name.strip() if dish_name else None,
        "tagged_restaurant_id": tagged_restaurant_id if tagged_restaurant_id else None,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "popular_photos": [],
        "quality_score": quality_score,
        "engagement_score": 0.0,
        "combined_score": quality_score * 0.6,
        "created_at": datetime.utcnow(),
    }

    result = await db.posts.insert_one(post_doc)
    post_id = str(result.inserted_id)
    
    print(f"✅ Post created with ID: {post_id}, category: '{post_doc.get('category')}'")

    # Save moderation result with post_id
    if moderation_result:
        await save_moderation_result(
            db=db,
            moderation_result=moderation_result,
            post_id=post_id
        )

    # ======================================================
    # WALLET REWARD CALCULATION
    # ======================================================
    wallet_result = None
    wallet_info = None

    # Only for regular users (not restaurants)
    if current_user.get("account_type") != "restaurant":
        # Prepare post data for wallet check (include coordinates)
        post_data_for_wallet = {
            "review_text": review_text,
            "location_name": final_location_name,
            "tagged_restaurant_id": tagged_restaurant_id,
            "has_media": True,  # Media is required
            "latitude": latitude,      # Post location (from map link)
            "longitude": longitude     # Post location (from map link)
        }

        # Calculate wallet reward with user's current location
        wallet_result = await calculate_wallet_reward(
            db=db,
            user=current_user,
            post_data=post_data_for_wallet,
            user_latitude=user_latitude,    # User's GPS location
            user_longitude=user_longitude   # User's GPS location
        )
        
        # Process wallet reward (update balance, create transaction)
        wallet_info = await process_wallet_reward(
            db=db,
            user_id=str(current_user["_id"]),
            reward_result=wallet_result,
            post_id=post_id,
            location_name=final_location_name,
            restaurant_id=tagged_restaurant_id
        )
        
        print(f"💰 Wallet reward: ₹{wallet_result.wallet_earned} for user {current_user['_id']} - Reason: {wallet_result.reason}")

    # ======================================================
    # LEVEL UPDATE
    # ======================================================
    user_id = str(current_user["_id"])
    total_posts_count = await db.posts.count_documents({"user_id": user_id})
    # Get the user's level BEFORE this post to determine points earned
    user_level_before_post = current_user.get("level", 1)
    points_earned_for_post = get_points_for_level(user_level_before_post)

    level_update = recalculate_points_from_post_count(total_posts_count)
    # Add pointsEarned so the frontend knows which GIF to show
    level_update["pointsEarned"] = points_earned_for_post

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

    # ======================================================
    # BUILD RESPONSE WITH WALLET INFO
    # ======================================================
    response = {
        "message": "Post created successfully",
        "post_id": post_id,
        "level_update": level_update,
    }

    # Add wallet reward info to response (only for regular users)
    if wallet_result:
        response["wallet_reward"] = {
            "wallet_earned": wallet_result.wallet_earned,
            "points_earned": wallet_result.points_earned,
            "reason": wallet_result.reason,
            "message": wallet_result.message,
            "tip": wallet_result.tip,
            "new_balance": wallet_info.get("wallet_balance", 0) if wallet_info else 0
        }

    return response


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
        page_size = limit or 30
        fetch_limit = min((skip + page_size) * 3, 3000)

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

            is_clicked = await db.post_clicks.find_one({
                "post_id": post_id,
                "user_id": str(current_user["_id"])
            }) is not None

            is_viewed = await db.post_views.find_one({
                "post_id": post_id,
                "user_id": str(current_user["_id"])
            }) is not None

            result.append({
                "id": post_id,
                "user_id": restaurant_id,
                "username": post.get("restaurant_name") or (restaurant["restaurant_name"] if restaurant else "Unknown"),
                "user_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                "user_badge": "verified" if (restaurant and (restaurant.get("badge") == "verified" or restaurant.get("is_verified"))) else None,
                "user_level": None,
                "media_url": post.get("media_url", ""),
                "image_url": post.get("image_url"),
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": post.get("media_type", "image"),
                "rating": None,
                "price": post.get("price", ""),
                "review_text": post.get("about", ""),
                "about": post.get("about", ""),
                "description": post.get("about", ""),
                "map_link": post.get("map_link"),
                "location_name": post.get("location_name"),
                "category": post.get("category"),
                "dish_name": post.get("dish_name"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "shares_count": post.get("shares_count", 0),
                "clicks_count": post.get("clicks_count", 0),
                "views_count": post.get("views_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "is_clicked_by_user": is_clicked,
                "is_viewed_by_user": is_viewed,
                "is_following": False,
                "account_type": "restaurant",
                "tagged_restaurant": None,
                "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
            })
        else:
            # User post
            user_id = post["user_id"]
            user = await db.users.find_one({"_id": ObjectId(user_id)})

            # Lookup tagged restaurant
            tagged_restaurant = None
            if post.get("tagged_restaurant_id"):
                try:
                    restaurant = await db.restaurants.find_one({"_id": ObjectId(post["tagged_restaurant_id"])})
                    if restaurant:
                        tagged_restaurant = {
                            "id": str(restaurant["_id"]),
                            "restaurant_name": restaurant["restaurant_name"]
                        }
                except Exception as e:
                    print(f"Error fetching tagged restaurant: {e}")

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

            is_clicked = await db.post_clicks.find_one({
                "post_id": post_id,
                "user_id": str(current_user["_id"])
            }) is not None

            is_viewed = await db.post_views.find_one({
                "post_id": post_id,
                "user_id": str(current_user["_id"])
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
                "price": None,
                "review_text": post.get("review_text", ""),
                "description": post.get("review_text", ""),
                "map_link": post.get("map_link"),
                "location_name": post.get("location_name"),
                "category": post.get("category"),
                "dish_name": post.get("dish_name"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "shares_count": post.get("shares_count", 0),
                "clicks_count": post.get("clicks_count", 0),
                "views_count": post.get("views_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "is_clicked_by_user": is_clicked,
                "is_viewed_by_user": is_viewed,
                "is_following": is_following,
                "account_type": "user",
                "tagged_restaurant": tagged_restaurant,
                "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
            })

    return result

# ==================== LAST 3 DAYS POSTS ENDPOINT ====================

@app.get("/api/posts/last-3-days")
async def get_last_3_days_posts(current_user: dict = Depends(get_current_user)):
    """Get top 10 posts from the last 2 days, ranked by quality + engagement."""
    db = get_database()

    blocked_user_ids = await get_blocked_user_ids(str(current_user["_id"]), db)

    # Calculate the date 2 days ago
    two_days_ago = datetime.utcnow() - timedelta(days=2)

    # Query posts created in the last 2 days, excluding blocked users
    query = {"created_at": {"$gte": two_days_ago}}
    if blocked_user_ids:
        query["user_id"] = {"$nin": blocked_user_ids}

    posts = await db.posts.find(query).sort("created_at", -1).to_list(None)

    result = []
    post_quality_map = {}

    for post in posts:
        post_id = str(post["_id"])
        user_id = post["user_id"]
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        user_posts_count = await db.posts.count_documents({"user_id": user_id})
        user_followers_count = await db.follows.count_documents({"followingId": user_id})

        # Store quality_score from the raw post document
        post_quality_map[post_id] = post.get("quality_score", 50.0)

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
            "user_followers_count": user_followers_count,
            "user_posts_count": user_posts_count,
            "media_url": media_url,
            "image_url": image_url,
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "is_following": is_following,
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })

    # Score and rank posts
    if result:
        max_likes = max((p["likes_count"] for p in result), default=1) or 1

        for p in result:
            quality = post_quality_map.get(p["id"], 50.0)
            engagement = lb_engagement_score(p["likes_count"], max_likes)
            combined = lb_combined_score(quality, engagement)
            p["quality_score"] = quality
            p["engagement_score"] = engagement
            p["combined_score"] = combined

        # Sort by combined score descending, take top 10
        result.sort(key=lambda x: x["combined_score"], reverse=True)
        result = result[:10]

        # Assign rank 1-10
        for idx, p in enumerate(result, start=1):
            p["rank"] = idx

    return result

# ==================== POST CLICK TRACKING ====================

@app.post("/api/posts/{post_id}/click")
async def track_post_click(post_id: str, current_user: dict = Depends(get_current_user)):
    """Increment clicks_count on a post when a user taps it. One click per user per post."""
    db = get_database()
    user_id = str(current_user["_id"])

    # Check if this user already clicked this post
    existing_click = await db.post_clicks.find_one({
        "post_id": post_id,
        "user_id": user_id
    })

    if existing_click:
        return {"status": "already_clicked"}

    # Record the click
    await db.post_clicks.insert_one({
        "post_id": post_id,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    })

    # Increment clicks_count — try user posts first, then restaurant posts
    result = await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"clicks_count": 1}}
    )
    if result.matched_count == 0:
        await db.restaurant_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"clicks_count": 1}}
        )

    return {"status": "ok"}

# ==================== POST VIEW TRACKING ====================

@app.post("/api/posts/{post_id}/view")
async def track_post_view(post_id: str, current_user: dict = Depends(get_current_user)):
    """Increment views_count on a video post when a user watches it. One view per user per post."""
    db = get_database()
    user_id = str(current_user["_id"])

    # Check if this user already viewed this post
    existing_view = await db.post_views.find_one({
        "post_id": post_id,
        "user_id": user_id
    })

    if existing_view:
        return {"status": "already_viewed"}

    # Record the view
    await db.post_views.insert_one({
        "post_id": post_id,
        "user_id": user_id,
        "created_at": datetime.utcnow()
    })

    # Increment views_count — try user posts first, then restaurant posts
    result = await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"views_count": 1}}
    )
    if result.matched_count == 0:
        await db.restaurant_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"views_count": 1}}
        )

    return {"status": "ok"}

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

# ==================== SHARE POST ENDPOINT ====================

@app.post("/api/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Increment share count for a post"""
    db = get_database()

    # Try user post first, then restaurant post
    result = await db.posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"shares_count": 1}}
    )

    if result.matched_count == 0:
        result = await db.restaurant_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"shares_count": 1}}
        )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    return {"message": "Share count updated"}

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
            "user_badge": user.get("badge") if user else None,
            "media_url": post.get("media_url", ""),
            "mediaUrl": post.get("media_url", ""),  # For compatibility
            "image_url": post.get("media_url") if media_type == "image" else None,
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "dish_name": post.get("dish_name"),
            "thumbnail_url": post.get("thumbnail_url"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": True,
            "created_at": post["created_at"],
            "saved_at": saved["created_at"]
        })
    
    return result


@app.get("/api/liked/list")
async def list_liked_posts(skip: int = 0, limit: int = 100, current_user: dict = Depends(get_current_user)):
    """Get posts liked by the current user (latest 100 max)"""
    db = get_database()
    user_id = str(current_user["_id"])

    limit = min(limit, 100)

    likes = await db.likes.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for like in likes:
        post = await db.posts.find_one({"_id": ObjectId(like["post_id"])})
        if not post:
            continue

        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        media_type = post.get("media_type", "image")

        result.append({
            "_id": str(post["_id"]),
            "id": str(post["_id"]),
            "user_id": post["user_id"],
            "username": user.get("username", "Unknown") if user else "Unknown",
            "full_name": user.get("full_name", user.get("username", "Unknown")) if user else "Unknown",
            "user_profile_picture": user.get("profile_picture") if user else None,
            "user_badge": user.get("badge") if user else None,
            "media_url": post.get("media_url", ""),
            "media_type": media_type,
            "thumbnail_url": post.get("thumbnail_url"),
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "location_name": post.get("location_name"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
            "created_at": post["created_at"],
            "liked_at": like.get("created_at"),
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

    user_id = str(current_user["_id"])

    # Deduct ₹25 from wallet on any post deletion
    wallet_deducted = 0.0
    if current_user.get("account_type") != "restaurant":
        deduct_amount = 25.0
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"wallet_balance": -deduct_amount}}
        )
        await db.wallet_transactions.insert_one({
            "user_id": user_id,
            "amount": -deduct_amount,
            "type": "deducted",
            "description": "Post deleted",
            "post_id": post_id,
            "created_at": datetime.utcnow()
        })
        wallet_deducted = deduct_amount
        print(f"💸 Deducted ₹{deduct_amount} from user {user_id} wallet for deleted post {post_id}")

    # Recalculate user points based on remaining posts
    # Formula: total_points = number_of_posts × 25
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
        "level_update": level_update,
        "wallet_deducted": wallet_deducted
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
            "user_badge": user.get("badge") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
            "user_badge": user.get("badge") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
            "user_badge": user.get("badge") if user else None,
            "media_url": post.get("media_url", ""),
            "image_url": image_url,
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
            "user_badge": user.get("badge") if user else None,
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
    Searches across: review_text, location_name, dish_name, and username.
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
            {"dish_name": search_regex},
        ]
    }
    if blocked_user_ids:
        search_query["user_id"] = {"$nin": blocked_user_ids}
    
    # Get all posts that match the search query
    all_posts = await db.posts.find(search_query).to_list(None)

    # Also search restaurant_posts collection
    restaurant_search_query = {
        "$or": [
            {"review_text": search_regex},
            {"caption": search_regex},
            {"location_name": search_regex},
            {"dish_name": search_regex},
        ]
    }
    restaurant_posts_matched = await db.restaurant_posts.find(restaurant_search_query).to_list(None)
    # Tag them so we can handle them differently in the result building
    for rp in restaurant_posts_matched:
        rp["_is_restaurant_post"] = True
    all_posts.extend(restaurant_posts_matched)

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
        dish_name = (post.get("dish_name") or "").lower()

        # Exact match in dish_name (highest priority - most specific)
        if query in dish_name:
            if dish_name.startswith(query):
                score += 110  # Dish name starts with query - highest relevance
            else:
                score += 95   # Dish name contains query

        # Exact match in review_text
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
        post_id_str = str(post["_id"])
        current_user_id = str(current_user["_id"])
        is_restaurant_post = post.get("_is_restaurant_post", False)

        if is_restaurant_post:
            restaurant_id = post.get("restaurant_id")
            restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)}) if restaurant_id else None

            is_liked = await db.restaurant_likes.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            is_saved = await db.restaurant_saved_posts.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            media_type = post.get("media_type", "image")
            result.append({
                "id": post_id_str,
                "user_id": restaurant_id,
                "username": restaurant.get("restaurant_name", "Restaurant") if restaurant else "Restaurant",
                "user_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                "user_badge": None,
                "media_url": post.get("media_url", ""),
                "image_url": post.get("image_url") if media_type == "image" else None,
                "rating": post.get("rating", 0),
                "review_text": post.get("review_text") or post.get("caption", ""),
                "caption": post.get("review_text") or post.get("caption", ""),
                "location_name": post.get("location_name"),
                "map_link": post.get("map_link"),
                "dish_name": post.get("dish_name"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "shares_count": post.get("shares_count", 0),
                "clicks_count": post.get("clicks_count", 0),
                "views_count": post.get("views_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "created_at": post.get("created_at"),
                "media_type": media_type,
                "account_type": "restaurant",
                "relevance_score": score,
            })
        else:
            user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
            is_liked = await db.likes.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            is_saved = await db.saved_posts.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            media_type = post.get("media_type", "image")
            image_url = post.get("image_url") if media_type == "image" else None

            result.append({
                "id": post_id_str,
                "user_id": post["user_id"],
                "username": user["full_name"] if user else "Unknown",
                "user_profile_picture": user.get("profile_picture") if user else None,
                "user_badge": user.get("badge") if user else None,
                "media_url": post.get("media_url", ""),
                "image_url": image_url,
                "rating": post.get("rating", 0),
                "review_text": post.get("review_text", ""),
                "caption": post.get("review_text", ""),
                "location_name": post.get("location_name"),
                "map_link": post.get("map_link"),
                "dish_name": post.get("dish_name"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "shares_count": post.get("shares_count", 0),
                "clicks_count": post.get("clicks_count", 0),
                "views_count": post.get("views_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "created_at": post["created_at"],
                "media_type": post.get("media_type", "image"),
                "relevance_score": score,
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

@app.get("/api/search/restaurants")
async def search_restaurants_by_menu(
    q: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Search restaurants whose menu items match the query.
    Returns restaurant profiles with matching menu items.
    """
    if not q or not q.strip():
        return []

    db = get_database()
    query = q.strip().lower()

    # Split query into individual words and build regex that matches ANY word
    words = [w for w in query.split() if len(w) >= 2]
    if not words:
        return []

    # Regex: match any of the words (e.g. "butter|chicken")
    any_word_pattern = "|".join(words)
    any_word_regex = {"$regex": any_word_pattern, "$options": "i"}
    # Also keep the full query regex for restaurant name search
    full_query_regex = {"$regex": query, "$options": "i"}

    # Search menu_items collection - match ANY word from the query
    menu_query = {"$or": [{"name": any_word_regex}, {"category": any_word_regex}, {"description": any_word_regex}]}
    # Only filter by status if the field exists (some items might not have status)
    matching_items = await db.menu_items.find({
        **menu_query,
        "$or": menu_query["$or"] + [{"name": any_word_regex}],
    }).to_list(None)

    # Deduplicate: re-query properly
    matching_items = await db.menu_items.find({
        "$and": [
            {"$or": [
                {"name": any_word_regex},
                {"category": any_word_regex},
                {"description": any_word_regex},
            ]},
        ]
    }).to_list(None)

    # Group by restaurant_id
    restaurant_items_map = {}
    seen_items = set()
    for item in matching_items:
        rid = item.get("restaurant_id")
        item_name = item.get("name", "")
        if not rid:
            continue
        # Deduplicate items per restaurant
        item_key = f"{rid}_{item_name}"
        if item_key in seen_items:
            continue
        seen_items.add(item_key)

        if rid not in restaurant_items_map:
            restaurant_items_map[rid] = []
        restaurant_items_map[rid].append({
            "name": item.get("name"),
            "price": item.get("price"),
            "category": item.get("category"),
            "image_url": item.get("image_url"),
        })

    # Also search by restaurant_name directly (full query and individual words)
    matching_restaurants_by_name = await db.restaurants.find({
        "$or": [
            {"restaurant_name": full_query_regex},
            {"restaurant_name": any_word_regex},
            {"cuisine_type": any_word_regex},
        ]
    }).to_list(None)

    for r in matching_restaurants_by_name:
        rid = str(r["_id"])
        if rid not in restaurant_items_map:
            restaurant_items_map[rid] = []

    # Build result with restaurant profiles
    result = []
    for restaurant_id, menu_matches in restaurant_items_map.items():
        try:
            restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
        except Exception:
            continue
        if not restaurant:
            continue

        # Get post count for this restaurant
        post_count = await db.restaurant_posts.count_documents({"restaurant_id": restaurant_id})

        # Get follower count
        follower_count = await db.follows.count_documents({"followingId": restaurant_id})

        result.append({
            "id": restaurant_id,
            "restaurant_name": restaurant.get("restaurant_name", "Restaurant"),
            "profile_picture": restaurant.get("profile_picture"),
            "location": restaurant.get("location") or restaurant.get("address"),
            "cuisine_type": restaurant.get("cuisine_type"),
            "post_count": post_count,
            "follower_count": follower_count,
            "matching_menu_items": menu_matches[:5],  # Top 5 matching items
            "account_type": "restaurant",
        })

    # Sort by number of matching menu items (most relevant first)
    result.sort(key=lambda x: len(x["matching_menu_items"]), reverse=True)

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
    
    # ✅ Track search appearances - INSIDE the function, BEFORE return
    if result:  # Only track if restaurants were found
        try:
            for restaurant in restaurants:
                await db.restaurant_analytics.insert_one({
                    "restaurant_id": str(restaurant["_id"]),
                    "event_type": "search_appearance",
                    "search_query": q.strip(),
                    "user_id": str(current_user.get("_id")) if current_user else None,
                    "created_at": datetime.utcnow()
                })
        except Exception as e:
            print(f"Analytics tracking error: {e}")
            # Don't fail the search if analytics fails
    
    return result  # ✅ Return AFTER tracking

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
            "user_badge": user.get("badge") if user else None,
            "user_level": user.get("level", 1) if user else 1,
            "media_url": post.get("media_url") or post.get("image_url", ""),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "rating": post.get("rating"),
            "review_text": post.get("review_text", ""),
            "location_name": post.get("location_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
            "dish_name": post.get("dish_name"),
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

# ==================== SUGGESTED USERS ENDPOINT ====================

@app.get("/api/users/suggestions")
async def get_suggested_users(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """
    Get suggested users for the current user to follow.
    Returns users that:
    - Current user is NOT already following
    - Have at least 1 post
    - Are not blocked
    - Include their latest post media
    """
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Get list of users current user is already following
    following_docs = await db.follows.find({
        "followerId": current_user_id
    }).to_list(None)
    following_ids = [f["followingId"] for f in following_docs]
    
    # Add current user to exclusion list
    exclude_ids = following_ids + [current_user_id]
    
    # Get blocked users
    blocked_user_ids = await get_blocked_user_ids(current_user_id, db)
    exclude_ids.extend(blocked_user_ids)
    
    # Get users with at least 1 post, excluding already followed and blocked
    pipeline = [
        # Get all posts grouped by user
        {"$group": {
            "_id": "$user_id",
            "post_count": {"$sum": 1},
            "latest_post": {"$last": "$$ROOT"}
        }},
        # Filter users not in exclude list
        {"$match": {
            "_id": {"$nin": exclude_ids},
            "post_count": {"$gte": 1}
        }},
        # Sort by post count (more active users first) with some randomness
        {"$sample": {"size": limit * 3}},  # Get more than needed for variety
        {"$limit": limit}
    ]
    
    user_posts = await db.posts.aggregate(pipeline).to_list(limit)
    
    result = []
    for item in user_posts:
        user_id = item["_id"]
        latest_post = item["latest_post"]
        
        # Get user details
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            continue
        
        # Determine media URL (use thumbnail for videos)
        media_type = latest_post.get("media_type", "image")
        if media_type == "video":
            display_media = latest_post.get("thumbnail_url") or latest_post.get("media_url")
        else:
            display_media = latest_post.get("media_url") or latest_post.get("image_url")
        
        result.append({
            "id": user_id,
            "user_id": user_id,
            "username": user.get("full_name") or user.get("username") or "Unknown",
            "profile_picture": user.get("profile_picture"),
            "level": user.get("level", 1),
            "post_count": item["post_count"],
            "latest_post": {
                "id": str(latest_post["_id"]),
                "media_url": display_media,
                "media_type": media_type,
                "thumbnail_url": latest_post.get("thumbnail_url"),
                "rating": latest_post.get("rating"),
                "location_name": latest_post.get("location_name"),
            },
            "is_following": False  # Always false since we filtered these out
        })
    
    # Shuffle for variety on each request
    random.shuffle(result)
    
    return result

@app.get("/api/users/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's own profile"""
    # Check if it's a restaurant account
    if current_user.get("account_type") == "restaurant":
        return {
            "id": str(current_user["_id"]),
            "full_name": current_user.get("restaurant_name", "Restaurant"),
            "username": current_user.get("restaurant_name", "Restaurant"),
            "restaurant_name": current_user.get("restaurant_name"),
            "email": current_user["email"],
            "profile_picture": current_user.get("profile_picture"),
            "bio": current_user.get("bio"),
            "points": 0,
            "level": None,
            "currentPoints": 0,
            "requiredPoints": 0,
            "title": "Restaurant",
            "badge": "verified" if current_user.get("is_verified", False) else None,
            "followers_count": current_user.get("followers_count", 0),
            "following_count": current_user.get("following_count", 0),
            "phone_number": current_user.get("phone_number"),
            "phone_verified": current_user.get("phone_verified", False),
            "account_type": "restaurant",
            "created_at": current_user["created_at"]
        }

    # Regular user response
    return {
        "id": str(current_user["_id"]),
        "full_name": current_user["full_name"],
        "username": current_user.get("username"),
        "email": current_user["email"],
        "profile_picture": current_user.get("profile_picture"),
        "bio": current_user.get("bio"),
        "points": current_user.get("points", 0),
        "level": current_user.get("level", 1),
        "currentPoints": current_user.get("currentPoints", 0),
        "requiredPoints": current_user.get("requiredPoints", 1250),
        "title": current_user.get("title", "Reviewer"),
        "badge": current_user.get("badge"),
        "followers_count": current_user.get("followers_count", 0),
        "following_count": current_user.get("following_count", 0),
        "completed_deliveries_count": current_user.get("completed_deliveries_count", 0),
        "wallet_balance": current_user.get("wallet_balance", 0.0),
        "account_type": "user",
        "created_at": current_user["created_at"]
    }


# NOTE: This route MUST be before /api/users/{user_id} to avoid route conflict
@app.get("/api/users/blocked-list")
async def get_blocked_users_list(current_user: dict = Depends(get_current_user)):
    """Get list of blocked users"""
    db = get_database()

    # Get all blocks for current user
    blocks = await db.blocks.find({
        "blocker_id": str(current_user["_id"])
    }).to_list(None)

    result = []
    for block in blocks:
        blocked_id = block.get("blocked_id")
        try:
            blocked_object_id = ObjectId(blocked_id)
        except (InvalidId, TypeError):
            print(f"⚠️ Skipping invalid blocked user id: {blocked_id}")
            continue

        user = await db.users.find_one({"_id": blocked_object_id})
        if user:
            created_at = block.get("created_at")
            if isinstance(created_at, datetime):
                blocked_at = created_at.isoformat() + "Z"
            elif created_at is None:
                blocked_at = None
            else:
                blocked_at = str(created_at)
            result.append({
                "id": str(user["_id"]),
                "user_id": str(user["_id"]),
                "full_name": user.get("full_name", "Unknown"),
                "username": user.get("username") or user.get("full_name", "Unknown"),
                "profile_picture": user.get("profile_picture"),
                "level": user.get("level", 1),
                "blocked_at": blocked_at
            })

    return result


@app.get("/api/users/{user_id}")
async def get_user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user profile by ID"""
    db = get_database()

     # Check if this user is blocked
    is_blocked = await db.blocks.find_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id
    })
    
    if is_blocked:
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
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
async def get_user_stats(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    db = get_database()

    # Check if this user is blocked
    is_blocked = await db.blocks.find_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id
    })
    
    if is_blocked:
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
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
async def get_user_posts(user_id: str, media_type: str = None, skip: int = 0, limit: int = None, current_user: dict = Depends(get_current_user)):
    """Get user's posts, optionally filtered by media type. Returns all posts if limit is not specified."""
    db = get_database()

    # Check if this user is blocked
    is_blocked = await db.blocks.find_one({
        "blocker_id": str(current_user["_id"]),
        "blocked_id": user_id
    })
    
    if is_blocked:
        raise HTTPException(status_code=403, detail="You have blocked this user")
    
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
            "category": post.get("category"), 
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
        is_restaurant_post = False

        if not post:
            # Also check restaurant_posts collection
            post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
            if post:
                is_restaurant_post = True
            else:
                raise HTTPException(status_code=404, detail="Post not found")

        current_user_id = str(current_user["_id"])
        post_id_str = str(post["_id"])

        if is_restaurant_post:
            restaurant_id = post.get("restaurant_id")
            restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)}) if restaurant_id else None

            is_liked = await db.restaurant_likes.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            is_saved = await db.restaurant_saved_posts.find_one({
                "post_id": post_id_str,
                "user_id": current_user_id
            }) is not None

            is_following = await db.follows.find_one({
                "followerId": current_user_id,
                "followingId": restaurant_id
            }) is not None

            media_type = post.get("media_type", "image")
            return {
                "id": post_id_str,
                "user_id": restaurant_id,
                "username": restaurant.get("restaurant_name", "Restaurant") if restaurant else "Restaurant",
                "user_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                "restaurant_profile_picture": restaurant.get("profile_picture") if restaurant else None,
                "user_badge": None,
                "user_level": 1,
                "media_url": post.get("media_url", ""),
                "image_url": post.get("image_url") if media_type == "image" else None,
                "thumbnail_url": post.get("thumbnail_url"),
                "media_type": media_type,
                "rating": post.get("rating", 0),
                "review_text": post.get("review_text") or post.get("caption", ""),
                "map_link": post.get("map_link"),
                "location_name": post.get("location_name"),
                "category": post.get("category"),
                "dish_name": post.get("dish_name"),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "shares_count": post.get("shares_count", 0),
                "is_liked_by_user": is_liked,
                "is_saved_by_user": is_saved,
                "is_following": is_following,
                "account_type": "restaurant",
                "created_at": post.get("created_at")
            }

        user = await db.users.find_one({"_id": ObjectId(post["user_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="Post author not found")

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
            "user_badge": user.get("badge"),
            "user_level": user.get("level", 1),
            "media_url": post.get("media_url", ""),
            "image_url": image_url,
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": media_type,
            "rating": post.get("rating", 0),
            "review_text": post.get("review_text", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "shares_count": post.get("shares_count", 0),
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
async def share_preview(request: Request, post_id: str):
    db = get_database()
    post = await db.posts.find_one({"_id": ObjectId(post_id)})

    if not post:
        return HTMLResponse("<h1>Post not found</h1>", status_code=404)

    BASE_URL = "https://api.cofau.com"
    DEEP_LINK_URL = f"cofau://post/{post_id}"
    APP_STORE_URL = "https://apps.apple.com/app/cofau/id6758019920"
    PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.cofau.app"

    title = post.get("review_text", "Cofau Post")
    rating = post.get("rating", 0)
    location = post.get("location_name", "")
    description = f"Rated {rating}/10 {('- ' + location) if location else ''} on Cofau!"

    media_type = post.get("media_type", "image")
    if media_type == "video":
        image_url = post.get("thumbnail_url") or post.get("media_url") or post.get("image_url", "")
    else:
        image_url = post.get("media_url") or post.get("image_url", "")

    if image_url and not image_url.startswith("http"):
        image_url = f"{BASE_URL}{image_url}"

    image_width = "1920"
    image_height = "1080"

    # Detect bots/crawlers — they get OG meta tags only
    user_agent = request.headers.get("user-agent", "").lower()
    is_bot = any(bot in user_agent for bot in [
        "facebookexternalhit", "facebot", "twitterbot", "whatsapp",
        "linkedinbot", "slackbot", "telegrambot", "pinterest",
        "googlebot", "bingbot", "yandex", "applebot"
    ])

    if is_bot:
        # Bots get clean OG meta tags for preview cards
        html = f"""<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{title}</title>
            <meta property="og:title" content="{title}" />
            <meta property="og:description" content="{description}" />
            <meta property="og:image" content="{image_url}" />
            <meta property="og:image:secure_url" content="{image_url}" />
            <meta property="og:image:type" content="image/jpeg" />
            <meta property="og:url" content="{BASE_URL}/share/{post_id}" />
            <meta property="og:type" content="article" />
            <meta property="og:site_name" content="Cofau" />
            <meta property="og:image:width" content="{image_width}" />
            <meta property="og:image:height" content="{image_height}" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="{title}" />
            <meta name="twitter:description" content="{description}" />
            <meta name="twitter:image" content="{image_url}" />
        </head>
        <body></body>
        </html>"""
        return HTMLResponse(content=html)

    # Real users get smart redirect — tries deep link, falls back to store
    html = f"""<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>{title}</title>
        <meta property="og:title" content="{title}" />
        <meta property="og:description" content="{description}" />
        <meta property="og:image" content="{image_url}" />
        <meta property="og:image:secure_url" content="{image_url}" />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:url" content="{BASE_URL}/share/{post_id}" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Cofau" />
        <meta property="og:image:width" content="{image_width}" />
        <meta property="og:image:height" content="{image_height}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="{title}" />
        <meta name="twitter:description" content="{description}" />
        <meta name="twitter:image" content="{image_url}" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f8f9fa; display:flex; justify-content:center; align-items:center; min-height:100vh;">
        <div style="text-align:center; padding:40px 20px;">
            <div style="width:80px; height:80px; background:#4dd0e1; border-radius:20px; margin:0 auto 20px; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:40px; color:white; font-weight:bold; font-style:italic;">C</span>
            </div>
            <h2 style="color:#333; margin:0 0 8px;">Opening in Cofau...</h2>
            <p style="color:#888; font-size:14px; margin:0 0 24px;">If the app doesn't open automatically:</p>
            <a id="store-link" href="#" style="display:inline-block; background:#4dd0e1; color:white; text-decoration:none; padding:14px 32px; border-radius:12px; font-weight:600; font-size:16px;">
                Download Cofau
            </a>
        </div>
        <script>
            (function() {{
                var deepLink = "{DEEP_LINK_URL}";
                var ua = navigator.userAgent || '';
                var isIOS = /iPhone|iPad|iPod/i.test(ua);
                var isAndroid = /Android/i.test(ua);
                var storeUrl = isIOS ? "{APP_STORE_URL}" : "{PLAY_STORE_URL}";

                document.getElementById('store-link').href = storeUrl;

                // Try to open the app via deep link
                window.location.href = deepLink;

                // If app didn't open after 1.5s, redirect to store
                setTimeout(function() {{
                    if (!document.hidden) {{
                        window.location.href = storeUrl;
                    }}
                }}, 1500);
            }})();
        </script>
    </body>
    </html>"""

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


# Helper function to get blocked user IDs (use in other endpoints)
async def get_blocked_user_ids(current_user_id: str, db):
    """Get list of user IDs that current user has blocked"""
    blocks = await db.blocks.find({
        "blocker_id": current_user_id
    }).to_list(None)
    
    return [block["blocked_id"] for block in blocks]

# ==================== DELETE ACCOUNT ENDPOINT ====================

@app.delete("/api/auth/delete")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """
    Permanently delete user account and all associated data.
    This action cannot be undone.
    """
    db = get_database()
    user_id = str(current_user["_id"])
    
    print(f"🗑️ Starting account deletion for user: {user_id}")
    
    try:
        # 1. Delete all user's posts and their media files
        user_posts = await db.posts.find({"user_id": user_id}).to_list(None)
        deleted_posts_count = 0
        
        for post in user_posts:
            # Delete media file from server
            media_url = post.get("media_url") or post.get("image_url")
            if media_url and "/api/static/uploads/" in media_url:
                try:
                    filename = media_url.split("/api/static/uploads/")[-1]
                    file_path = os.path.join(settings.UPLOAD_DIR, filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"✅ Deleted media file: {file_path}")
                except Exception as e:
                    print(f"⚠️ Error deleting media file: {e}")
            
            # Delete thumbnail if exists (for videos)
            thumbnail_url = post.get("thumbnail_url")
            if thumbnail_url and "/api/static/uploads/" in thumbnail_url:
                try:
                    thumb_filename = thumbnail_url.split("/api/static/uploads/")[-1]
                    thumb_path = os.path.join(settings.UPLOAD_DIR, thumb_filename)
                    if os.path.exists(thumb_path):
                        os.remove(thumb_path)
                        print(f"✅ Deleted thumbnail: {thumb_path}")
                except Exception as e:
                    print(f"⚠️ Error deleting thumbnail: {e}")
            
            # Delete likes on this post
            await db.likes.delete_many({"post_id": str(post["_id"])})
            
            # Delete comments on this post
            await db.comments.delete_many({"post_id": str(post["_id"])})
            
            # Delete saved_posts references to this post
            await db.saved_posts.delete_many({"post_id": str(post["_id"])})
            
            deleted_posts_count += 1
        
        # Delete all posts
        await db.posts.delete_many({"user_id": user_id})
        print(f"✅ Deleted {deleted_posts_count} posts")
        
        # 2. Delete user's comments on other posts
        deleted_comments = await db.comments.delete_many({"user_id": user_id})
        print(f"✅ Deleted {deleted_comments.deleted_count} comments by user")
        
        # 3. Delete user's likes on other posts
        deleted_likes = await db.likes.delete_many({"user_id": user_id})
        print(f"✅ Deleted {deleted_likes.deleted_count} likes by user")
        
        # 4. Delete user's saved posts
        deleted_saved = await db.saved_posts.delete_many({"user_id": user_id})
        print(f"✅ Deleted {deleted_saved.deleted_count} saved posts")
        
        # 5. Delete follow relationships (both as follower and following)
        deleted_following = await db.follows.delete_many({"followerId": user_id})
        deleted_followers = await db.follows.delete_many({"followingId": user_id})
        print(f"✅ Deleted {deleted_following.deleted_count} following relationships")
        print(f"✅ Deleted {deleted_followers.deleted_count} follower relationships")
        
        # Update follower counts for users this person was following
        # (This is optional but keeps counts accurate)
        following_list = await db.follows.find({"followerId": user_id}).to_list(None)
        for follow in following_list:
            await db.users.update_one(
                {"_id": ObjectId(follow["followingId"])},
                {"$inc": {"followers_count": -1}}
            )
        
        # 6. Delete notifications (both sent and received)
        deleted_notif_to = await db.notifications.delete_many({"to_user_id": user_id})
        deleted_notif_from = await db.notifications.delete_many({"from_user_id": user_id})
        print(f"✅ Deleted {deleted_notif_to.deleted_count + deleted_notif_from.deleted_count} notifications")
        
        # 7. Delete compliments (both sent and received)
        try:
            deleted_comp_to = await db.compliments.delete_many({"to_user_id": user_id})
            deleted_comp_from = await db.compliments.delete_many({"from_user_id": user_id})
            print(f"✅ Deleted compliments")
        except Exception as e:
            print(f"⚠️ Error deleting compliments (collection may not exist): {e}")
        
        # 8. Delete blocks (both as blocker and blocked)
        deleted_blocks_by = await db.blocks.delete_many({"blocker_id": user_id})
        deleted_blocks_of = await db.blocks.delete_many({"blocked_id": user_id})
        print(f"✅ Deleted {deleted_blocks_by.deleted_count + deleted_blocks_of.deleted_count} block records")
        
        # 9. Delete reports made by user
        try:
            deleted_reports = await db.reports.delete_many({"reporter_id": user_id})
            print(f"✅ Deleted {deleted_reports.deleted_count} reports")
        except Exception as e:
            print(f"⚠️ Error deleting reports: {e}")
        
        # 10. Delete user's stories
        try:
            deleted_stories = await db.stories.delete_many({"user_id": user_id})
            print(f"✅ Deleted {deleted_stories.deleted_count} stories")
        except Exception as e:
            print(f"⚠️ Error deleting stories: {e}")
        
        # 11. Delete chat messages (optional - you may want to keep for other users)
        try:
            deleted_messages = await db.messages.delete_many({
                "$or": [
                    {"sender_id": user_id},
                    {"receiver_id": user_id}
                ]
            })
            print(f"✅ Deleted {deleted_messages.deleted_count} chat messages")
        except Exception as e:
            print(f"⚠️ Error deleting messages: {e}")
        
        # 12. Delete profile picture from server
        profile_picture = current_user.get("profile_picture")
        if profile_picture and "/api/static/uploads/" in profile_picture:
            try:
                pp_filename = profile_picture.split("/api/static/uploads/")[-1]
                pp_path = os.path.join(settings.UPLOAD_DIR, pp_filename)
                if os.path.exists(pp_path):
                    os.remove(pp_path)
                    print(f"✅ Deleted profile picture: {pp_path}")
            except Exception as e:
                print(f"⚠️ Error deleting profile picture: {e}")
        
        # 13. Delete cover/banner image from server
        cover_image = current_user.get("cover_image")
        if cover_image and "/api/static/uploads/" in cover_image:
            try:
                cover_filename = cover_image.split("/api/static/uploads/")[-1]
                cover_path = os.path.join(settings.UPLOAD_DIR, cover_filename)
                if os.path.exists(cover_path):
                    os.remove(cover_path)
                    print(f"✅ Deleted cover image: {cover_path}")
            except Exception as e:
                print(f"⚠️ Error deleting cover image: {e}")
        
        # 14. Finally, delete the user account
        result = await db.users.delete_one({"_id": current_user["_id"]})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete user account")
        
        print(f"✅ Account deletion complete for user: {user_id}")
        
        return {
            "message": "Account deleted successfully",
            "deleted_data": {
                "posts": deleted_posts_count,
                "comments": deleted_comments.deleted_count,
                "likes": deleted_likes.deleted_count,
                "saved_posts": deleted_saved.deleted_count,
                "follow_relationships": deleted_following.deleted_count + deleted_followers.deleted_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error during account deletion: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete account: {str(e)}"
        )


# ==================== DELETE RESTAURANT ACCOUNT ENDPOINT ====================

@app.delete("/api/restaurant/auth/delete")
async def delete_restaurant_account(
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/restaurant/auth/login"))
):
    """
    Permanently delete restaurant account and all associated data.
    This action cannot be undone.
    """
    from utils.jwt import verify_token
    
    db = get_database()
    
    # Verify token and get restaurant
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    restaurant = await db.restaurants.find_one({"email": email})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    restaurant_id = str(restaurant["_id"])
    print(f"🗑️ Starting account deletion for restaurant: {restaurant_id}")
    
    try:
        # 1. Delete all restaurant's posts and their media files
        restaurant_posts = await db.restaurant_posts.find({"restaurant_id": restaurant_id}).to_list(None)
        deleted_posts_count = 0
        
        for post in restaurant_posts:
            # Delete media file from server
            media_url = post.get("media_url")
            if media_url and "/api/static/uploads/" in media_url:
                try:
                    filename = media_url.split("/api/static/uploads/")[-1]
                    file_path = os.path.join(settings.UPLOAD_DIR, filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"✅ Deleted media file: {file_path}")
                except Exception as e:
                    print(f"⚠️ Error deleting media file: {e}")
            
            # Delete likes on this post
            await db.restaurant_likes.delete_many({"post_id": str(post["_id"])})
            
            # Delete saved_posts references
            await db.restaurant_saved_posts.delete_many({"post_id": str(post["_id"])})
            
            deleted_posts_count += 1
        
        # Delete all restaurant posts
        await db.restaurant_posts.delete_many({"restaurant_id": restaurant_id})
        print(f"✅ Deleted {deleted_posts_count} restaurant posts")
        
        # 2. Delete follow relationships
        deleted_followers = await db.follows.delete_many({"followingId": restaurant_id})
        print(f"✅ Deleted {deleted_followers.deleted_count} follower relationships")
        
        # 3. Delete notifications
        try:
            await db.notifications.delete_many({"to_user_id": restaurant_id})
            await db.notifications.delete_many({"from_user_id": restaurant_id})
            print(f"✅ Deleted notifications")
        except Exception as e:
            print(f"⚠️ Error deleting notifications: {e}")
        
        # 4. Delete profile picture from server
        profile_picture = restaurant.get("profile_picture")
        if profile_picture and "/api/static/uploads/" in profile_picture:
            try:
                pp_filename = profile_picture.split("/api/static/uploads/")[-1]
                pp_path = os.path.join(settings.UPLOAD_DIR, pp_filename)
                if os.path.exists(pp_path):
                    os.remove(pp_path)
                    print(f"✅ Deleted profile picture: {pp_path}")
            except Exception as e:
                print(f"⚠️ Error deleting profile picture: {e}")
        
        # 5. Delete cover image from server
        cover_image = restaurant.get("cover_image")
        if cover_image and "/api/static/uploads/" in cover_image:
            try:
                cover_filename = cover_image.split("/api/static/uploads/")[-1]
                cover_path = os.path.join(settings.UPLOAD_DIR, cover_filename)
                if os.path.exists(cover_path):
                    os.remove(cover_path)
                    print(f"✅ Deleted cover image: {cover_path}")
            except Exception as e:
                print(f"⚠️ Error deleting cover image: {e}")
        
        # 6. Finally, delete the restaurant account
        result = await db.restaurants.delete_one({"_id": restaurant["_id"]})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Failed to delete restaurant account")
        
        print(f"✅ Restaurant account deletion complete: {restaurant_id}")
        
        return {
            "message": "Restaurant account deleted successfully",
            "deleted_data": {
                "posts": deleted_posts_count
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error during restaurant account deletion: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete account: {str(e)}"
        )
