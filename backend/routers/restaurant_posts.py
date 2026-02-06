from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.restaurant_auth import get_current_restaurant
from routers.auth import get_current_user as get_current_user_optional
from config import settings
import os
import shutil

router = APIRouter(prefix="/api/restaurant/posts", tags=["Restaurant Posts"])

# Restaurant uploads directory
RESTAURANT_UPLOAD_DIR = os.path.join(settings.UPLOAD_DIR, "restaurants")
os.makedirs(RESTAURANT_UPLOAD_DIR, exist_ok=True)


@router.post("/create")
async def create_restaurant_post(
    price: str = Form(...),
    about: str = Form(...),
    map_link: str = Form(None),
    location_name: str = Form(None),
    category: str = Form(None),
    dish_name: str = Form(None),
    file: UploadFile = File(...),
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Create a new restaurant post (menu item, dish, etc.)"""
    db = get_database()
    
    # Get file extension
    file_ext = file.filename.split(".")[-1].lower()
    
    # Define allowed extensions
    ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "m4v"]
    ALL_ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS + ALLOWED_VIDEO_EXTENSIONS
    
    if file_ext not in ALL_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type: {file_ext}. Allowed: {ALL_ALLOWED_EXTENSIONS}"
        )
    
    # Generate unique filename
    unique_id = str(ObjectId())
    filename = f"{unique_id}_{file.filename}"
    file_path = os.path.join(RESTAURANT_UPLOAD_DIR, filename)
    
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
        
        print(f"✅ Restaurant file saved: {file_path} (size: {file_size} bytes)")
    except Exception as e:
        print(f"❌ Error saving restaurant file: {str(e)}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # HEIC/HEIF conversion (for iOS photos)
    if file_ext in ["heic", "heif"]:
        print(f"📱 iOS HEIC/HEIF detected - converting to JPEG...")
        try:
            from PIL import Image
            import pillow_heif
            
            pillow_heif.register_heif_opener()
            img = Image.open(file_path)
            
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            new_filename = f"{unique_id}_{os.path.splitext(file.filename)[0]}.jpg"
            new_file_path = os.path.join(RESTAURANT_UPLOAD_DIR, new_filename)
            
            img.save(new_file_path, 'JPEG', quality=90, optimize=True)
            img.close()
            
            os.remove(file_path)
            
            file_path = new_file_path
            filename = new_filename
            file_ext = "jpg"
            
            print(f"✅ Converted HEIC to JPEG: {new_filename}")
        except ImportError:
            print("❌ pillow-heif not installed")
            os.remove(file_path)
            raise HTTPException(
                status_code=500,
                detail="HEIC conversion not available. Please convert to JPEG before uploading."
            )
        except Exception as e:
            print(f"❌ HEIC conversion failed: {str(e)}")
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"Failed to convert HEIC: {str(e)}")
    
    # Detect media type
    media_type = "video" if file_ext in ["mp4", "mov", "m4v"] else "image"
    
    # Video optimization (if needed)
    thumbnail_url = None
    if media_type == "video":
        try:
            from utils.video_transcode import optimize_video_with_thumbnail
            
            video_path, thumbnail_path = await optimize_video_with_thumbnail(file_path)
            
            file_path = video_path
            filename = os.path.basename(video_path)
            
            thumbnail_filename = os.path.basename(thumbnail_path)
            thumbnail_url = f"/api/static/uploads/restaurants/{thumbnail_filename}"
            
            print(f"✅ Restaurant video optimized: {filename}")
        except Exception as e:
            print(f"❌ Video optimization failed: {str(e)}")
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
            raise HTTPException(
                status_code=500,
                detail=f"Video processing failed: {str(e)}"
            )
    
    # Clean map link
    clean_map_link = None
    if map_link:
        map_link = map_link.strip()
        if not map_link.startswith("http"):
            map_link = "https://" + map_link
        if "google.com/maps" in map_link or "goo.gl/maps" in map_link:
            clean_map_link = map_link
    
    # Media URL for restaurant posts
    media_url = f"/api/static/uploads/restaurants/{filename}"
    
    # Create restaurant post document
    post_doc = {
        "restaurant_id": str(current_restaurant["_id"]),
        "restaurant_name": current_restaurant["restaurant_name"],
        "media_url": media_url,
        "image_url": media_url if media_type == "image" else None,
        "thumbnail_url": thumbnail_url,
        "media_type": media_type,
        "price": price.strip(),
        "about": about.strip(),
        "map_link": clean_map_link,
        "location_name": location_name.strip() if location_name else None,
        "category": category.strip() if category else None,
        "dish_name": dish_name.strip() if dish_name else None,
        "likes_count": 0,
        "comments_count": 0,
        "account_type": "restaurant",
        "created_at": datetime.utcnow(),
    }
    
    result = await db.restaurant_posts.insert_one(post_doc)
    post_id = str(result.inserted_id)
    
    # Update restaurant's posts count
    await db.restaurants.update_one(
        {"_id": current_restaurant["_id"]},
        {"$inc": {"posts_count": 1}}
    )
    
    print(f"✅ Restaurant post created: {post_id}")
    
    return {
        "message": "Post created successfully",
        "post_id": post_id,
    }


@router.get("/feed")
async def get_restaurant_posts_feed(
    skip: int = 0,
    limit: int = 30,
    category: str = None,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Get restaurant posts feed (all restaurant posts)"""
    db = get_database()
    
    query = {}
    if category and category.strip() and category.lower() != 'all':
        import re
        query["category"] = {"$regex": re.escape(category.strip()), "$options": "i"}
    
    posts = await db.restaurant_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        # Get restaurant info
        restaurant = await db.restaurants.find_one({"_id": ObjectId(post["restaurant_id"])})
        
        # Check if current restaurant liked this post
        is_liked = await db.restaurant_likes.find_one({
            "post_id": str(post["_id"]),
            "restaurant_id": str(current_restaurant["_id"])
        }) is not None
        
        # Check if saved
        is_saved = await db.restaurant_saved_posts.find_one({
            "post_id": str(post["_id"]),
            "restaurant_id": str(current_restaurant["_id"])
        }) is not None
        
        result.append({
            "id": str(post["_id"]),
            "restaurant_id": post["restaurant_id"],
            "restaurant_name": post.get("restaurant_name") or (restaurant["restaurant_name"] if restaurant else "Unknown"),
            "restaurant_profile_picture": restaurant.get("profile_picture") if restaurant else None,
            "media_url": post.get("media_url", ""),
            "image_url": post.get("image_url"),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "price": post.get("price", ""),
            "about": post.get("about", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "is_liked_by_user": is_liked,
            "is_saved_by_user": is_saved,
            "account_type": "restaurant",
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    return result


@router.get("/my-posts")
async def get_my_restaurant_posts(
    skip: int = 0,
    limit: int = 50,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Get current restaurant's own posts"""
    db = get_database()
    
    posts = await db.restaurant_posts.find({
        "restaurant_id": str(current_restaurant["_id"])
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        result.append({
            "id": str(post["_id"]),
            "restaurant_id": post["restaurant_id"],
            "restaurant_name": current_restaurant["restaurant_name"],
            "restaurant_profile_picture": current_restaurant.get("profile_picture"),
            "media_url": post.get("media_url", ""),
            "image_url": post.get("image_url"),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "price": post.get("price", ""),
            "about": post.get("about", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "account_type": "restaurant",
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    return result


@router.get("/{post_id}")
async def get_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Get a single restaurant post by ID"""
    db = get_database()
    
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    restaurant = await db.restaurants.find_one({"_id": ObjectId(post["restaurant_id"])})
    
    is_liked = await db.restaurant_likes.find_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    }) is not None
    
    is_saved = await db.restaurant_saved_posts.find_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    }) is not None
    
    return {
        "id": str(post["_id"]),
        "restaurant_id": post["restaurant_id"],
        "restaurant_name": post.get("restaurant_name") or (restaurant["restaurant_name"] if restaurant else "Unknown"),
        "restaurant_profile_picture": restaurant.get("profile_picture") if restaurant else None,
        "media_url": post.get("media_url", ""),
        "image_url": post.get("image_url"),
        "thumbnail_url": post.get("thumbnail_url"),
        "media_type": post.get("media_type", "image"),
        "price": post.get("price", ""),
        "about": post.get("about", ""),
        "map_link": post.get("map_link"),
        "location_name": post.get("location_name"),
        "category": post.get("category"),
        "dish_name": post.get("dish_name"),
        "likes_count": post.get("likes_count", 0),
        "comments_count": post.get("comments_count", 0),
        "is_liked_by_user": is_liked,
        "is_saved_by_user": is_saved,
        "account_type": "restaurant",
        "created_at": post["created_at"],
    }


@router.delete("/{post_id}")
async def delete_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Delete a restaurant post"""
    db = get_database()
    
    # Find the post
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check ownership
    if post["restaurant_id"] != str(current_restaurant["_id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    # Get media URL to delete the file
    media_url = post.get("media_url") or post.get("image_url")
    
    # Delete the media file
    if media_url:
        try:
            if "/api/static/uploads/restaurants/" in media_url:
                filename = media_url.split("/api/static/uploads/restaurants/")[-1]
                file_path = os.path.join(RESTAURANT_UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"✅ Deleted restaurant media file: {file_path}")
        except Exception as e:
            print(f"⚠️ Error deleting media file: {e}")
    
    # Delete thumbnail if exists
    thumbnail_url = post.get("thumbnail_url")
    if thumbnail_url:
        try:
            if "/api/static/uploads/restaurants/" in thumbnail_url:
                thumbnail_filename = thumbnail_url.split("/api/static/uploads/restaurants/")[-1]
                thumbnail_path = os.path.join(RESTAURANT_UPLOAD_DIR, thumbnail_filename)
                if os.path.exists(thumbnail_path):
                    os.remove(thumbnail_path)
                    print(f"✅ Deleted thumbnail: {thumbnail_path}")
        except Exception as e:
            print(f"⚠️ Error deleting thumbnail: {e}")
    
    # Delete related data
    await db.restaurant_likes.delete_many({"post_id": post_id})
    await db.restaurant_comments.delete_many({"post_id": post_id})
    await db.restaurant_saved_posts.delete_many({"post_id": post_id})
    
    # Delete the post
    result = await db.restaurant_posts.delete_one({"_id": ObjectId(post_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Failed to delete post")
    
    # Update restaurant's posts count
    await db.restaurants.update_one(
        {"_id": current_restaurant["_id"]},
        {"$inc": {"posts_count": -1}}
    )
    
    return {"message": "Post deleted successfully"}


# ==================== LIKES ====================

@router.post("/{post_id}/like")
async def like_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Like a restaurant post"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already liked
    existing_like = await db.restaurant_likes.find_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    })
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked this post")
    
    # Add like
    await db.restaurant_likes.insert_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"]),
        "created_at": datetime.utcnow()
    })
    
    # Update post likes count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": 1}}
    )
    
    return {"message": "Post liked"}


@router.delete("/{post_id}/like")
async def unlike_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Unlike a restaurant post"""
    db = get_database()
    
    result = await db.restaurant_likes.delete_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Like not found")
    
    # Update post likes count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": -1}}
    )
    
    return {"message": "Post unliked"}


# ==================== SAVE POSTS ====================

@router.post("/{post_id}/save")
async def save_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Save a restaurant post"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if already saved
    existing_save = await db.restaurant_saved_posts.find_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    })
    
    if existing_save:
        raise HTTPException(status_code=400, detail="Post already saved")
    
    # Add save
    await db.restaurant_saved_posts.insert_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"]),
        "created_at": datetime.utcnow()
    })
    
    return {"message": "Post saved"}


@router.delete("/{post_id}/save")
async def unsave_restaurant_post(
    post_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Unsave a restaurant post"""
    db = get_database()
    
    result = await db.restaurant_saved_posts.delete_one({
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Post not saved")
    
    return {"message": "Post unsaved"}


# ==================== COMMENTS ====================

@router.post("/{post_id}/comment")
async def add_restaurant_comment(
    post_id: str,
    comment_text: str = Form(...),
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Add a comment to a restaurant post"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_doc = {
        "post_id": post_id,
        "restaurant_id": str(current_restaurant["_id"]),
        "restaurant_name": current_restaurant["restaurant_name"],
        "profile_pic": current_restaurant.get("profile_picture"),
        "comment_text": comment_text.strip(),
        "created_at": datetime.utcnow()
    }
    
    result = await db.restaurant_comments.insert_one(comment_doc)
    
    # Update post comments count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"comments_count": 1}}
    )
    
    return {"message": "Comment added", "comment_id": str(result.inserted_id)}


@router.get("/{post_id}/comments")
async def get_restaurant_post_comments(post_id: str):
    """Get all comments for a restaurant post"""
    db = get_database()
    
    comments = await db.restaurant_comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    
    result = []
    for comment in comments:
        result.append({
            "id": str(comment["_id"]),
            "post_id": post_id,
            "restaurant_id": comment["restaurant_id"],
            "restaurant_name": comment["restaurant_name"],
            "profile_pic": comment.get("profile_pic"),
            "comment_text": comment["comment_text"],
            "created_at": comment["created_at"]
        })
    
    return result


# ==================== PUBLIC ENDPOINTS (No Auth Required) ====================

@router.get("/public/all")
async def get_all_restaurant_posts_public(
    skip: int = 0,
    limit: int = 30,
    categories: str = None  # ← Parameter is "categories"
):
    """Get all restaurant posts (public - no auth required)"""
    db = get_database()
    
    query = {}
    
    # Handle multiple categories (comma-separated)
    if categories and categories.strip():  # ← Use "categories" here, not "category"
        import re
        category_list = [cat.strip() for cat in categories.split(",") if cat.strip().lower() != 'all']
        if category_list:
            query["category"] = {
                "$regex": "|".join([re.escape(cat) for cat in category_list]),
                "$options": "i"
            }
    
    posts = await db.restaurant_posts.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(post["restaurant_id"])})
        
        result.append({
            "id": str(post["_id"]),
            "restaurant_id": post["restaurant_id"],
            "restaurant_name": post.get("restaurant_name") or (restaurant["restaurant_name"] if restaurant else "Unknown"),
            "restaurant_profile_picture": restaurant.get("profile_picture") if restaurant else None,
            "media_url": post.get("media_url", ""),
            "image_url": post.get("image_url"),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "price": post.get("price", ""),
            "about": post.get("about", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "account_type": "restaurant",
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    return result


@router.get("/public/restaurant/{restaurant_id}")
async def get_restaurant_posts_by_id_public(
    restaurant_id: str,
    skip: int = 0,
    limit: int = 50
):
    """Get posts by a specific restaurant (public - no auth required)"""
    db = get_database()
    
    restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    posts = await db.restaurant_posts.find({
        "restaurant_id": restaurant_id
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for post in posts:
        result.append({
            "id": str(post["_id"]),
            "restaurant_id": post["restaurant_id"],
            "restaurant_name": restaurant["restaurant_name"],
            "restaurant_profile_picture": restaurant.get("profile_picture"),
            "media_url": post.get("media_url", ""),
            "image_url": post.get("image_url"),
            "thumbnail_url": post.get("thumbnail_url"),
            "media_type": post.get("media_type", "image"),
            "price": post.get("price", ""),
            "about": post.get("about", ""),
            "map_link": post.get("map_link"),
            "location_name": post.get("location_name"),
            "category": post.get("category"),
            "dish_name": post.get("dish_name"),
            "likes_count": post.get("likes_count", 0),
            "comments_count": post.get("comments_count", 0),
            "account_type": "restaurant",
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    return result


@router.get("/public/profile/{restaurant_id}")
async def get_restaurant_profile_public(restaurant_id: str):
    """Get public restaurant profile by ID (no auth required)"""
    db = get_database()
    
    try:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Get posts count
    posts_count = await db.restaurant_posts.count_documents({"restaurant_id": restaurant_id})
    
    # Get followers count
    followers_count = await db.follows.count_documents({"followingId": restaurant_id})
    
    return {
        "id": str(restaurant["_id"]),
        "restaurant_name": restaurant.get("restaurant_name"),
        "full_name": restaurant.get("restaurant_name"),  # For compatibility
        "profile_picture": restaurant.get("profile_picture"),
        "cover_image": restaurant.get("cover_image"),
        "bio": restaurant.get("bio"),
        "phone": restaurant.get("phone"),
        "address": restaurant.get("address"),
        "cuisine_type": restaurant.get("cuisine_type"),
        "posts_count": posts_count,
        "reviews_count": restaurant.get("reviews_count", 0),
        "followers_count": followers_count,
        "is_verified": restaurant.get("is_verified", False),
        "account_type": "restaurant",
        "created_at": restaurant["created_at"].isoformat() if restaurant.get("created_at") else None
    }

# ==================== MENU ITEMS ====================

@router.post("/menu/create")
async def create_menu_item(
    item_name: str = Form(...),
    price: str = Form(...),
    description: str = Form(None),
    category: str = Form(None),
    media_type: str = Form("image"),
    file: UploadFile = File(...),
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Create a new menu item - Restaurant only"""
    db = get_database()
    
    # Get file extension
    file_ext = file.filename.split(".")[-1].lower()
    
    ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    ALLOWED_VIDEO_EXTENSIONS = ["mp4", "mov", "m4v"]
    ALL_ALLOWED_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS + ALLOWED_VIDEO_EXTENSIONS
    
    if file_ext not in ALL_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file_ext}. Allowed: {ALL_ALLOWED_EXTENSIONS}"
        )
    
    # Generate unique filename
    unique_id = str(ObjectId())
    filename = f"menu_{unique_id}_{file.filename}"
    file_path = os.path.join(RESTAURANT_UPLOAD_DIR, filename)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Failed to save file")
        
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            os.remove(file_path)
            raise HTTPException(status_code=500, detail="File was saved but is empty")
        
        print(f"✅ Menu item file saved: {file_path} (size: {file_size} bytes)")
    except Exception as e:
        print(f"❌ Error saving menu file: {str(e)}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # HEIC/HEIF conversion
    if file_ext in ["heic", "heif"]:
        try:
            from PIL import Image
            import pillow_heif
            
            pillow_heif.register_heif_opener()
            img = Image.open(file_path)
            
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            new_filename = f"menu_{unique_id}_{os.path.splitext(file.filename)[0]}.jpg"
            new_file_path = os.path.join(RESTAURANT_UPLOAD_DIR, new_filename)
            
            img.save(new_file_path, 'JPEG', quality=90, optimize=True)
            img.close()
            os.remove(file_path)
            
            file_path = new_file_path
            filename = new_filename
            file_ext = "jpg"
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"Failed to convert HEIC: {str(e)}")
    
    # Detect media type
    actual_media_type = "video" if file_ext in ["mp4", "mov", "m4v"] else "image"
    
    # Video optimization
    thumbnail_url = None
    if actual_media_type == "video":
        try:
            from utils.video_transcode import optimize_video_with_thumbnail
            video_path, thumbnail_path = await optimize_video_with_thumbnail(file_path)
            file_path = video_path
            filename = os.path.basename(video_path)
            thumbnail_filename = os.path.basename(thumbnail_path)
            thumbnail_url = f"/api/static/uploads/restaurants/{thumbnail_filename}"
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"Video processing failed: {str(e)}")
    
    media_url = f"/api/static/uploads/restaurants/{filename}"
    
    # Create menu item document
    menu_doc = {
        "restaurant_id": str(current_restaurant["_id"]),
        "restaurant_name": current_restaurant["restaurant_name"],
        "item_name": item_name.strip(),
        "price": price.strip(),
        "description": description.strip() if description else "",
        "category": category.strip() if category else "",
        "media_url": media_url,
        "thumbnail_url": thumbnail_url,
        "media_type": actual_media_type,
        "is_available": True,
        "created_at": datetime.utcnow(),
    }
    
    result = await db.menu_items.insert_one(menu_doc)
    
    # Update restaurant's menu count
    await db.restaurants.update_one(
        {"_id": current_restaurant["_id"]},
        {"$inc": {"menu_count": 1}}
    )
    
    print(f"✅ Menu item created: {result.inserted_id}")
    
    return {
        "message": "Menu item created successfully",
        "menu_item_id": str(result.inserted_id),
    }

@router.get("/menu/{restaurant_id}")
async def get_restaurant_menu(
    restaurant_id: str,
    skip: int = 0,
    limit: int = 100
):
    """Get all menu items for a restaurant (public)"""
    db = get_database()
    
    menu_items = await db.menu_items.find({
        "restaurant_id": restaurant_id,
        "is_available": True
    }).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for item in menu_items:
        result.append({
            "id": str(item["_id"]),
            "restaurant_id": item["restaurant_id"],
            "item_name": item.get("item_name", ""),
            "price": item.get("price", ""),
            "description": item.get("description", ""),
            "category": item.get("category", ""),
            "media_url": item.get("media_url", ""),
            "thumbnail_url": item.get("thumbnail_url"),
            "media_type": item.get("media_type", "image"),
            "is_available": item.get("is_available", True),
            "created_at": item["created_at"].isoformat() if isinstance(item.get("created_at"), datetime) else item.get("created_at", ""),
        })
    
    return result

@router.delete("/menu/{item_id}")
async def delete_menu_item(
    item_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Delete a menu item - Owner only"""
    db = get_database()
    
    menu_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if menu_item["restaurant_id"] != str(current_restaurant["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete media file
    media_url = menu_item.get("media_url")
    if media_url and "/api/static/uploads/restaurants/" in media_url:
        try:
            filename = media_url.split("/api/static/uploads/restaurants/")[-1]
            file_path = os.path.join(RESTAURANT_UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"⚠️ Error deleting menu media: {e}")
    
    await db.menu_items.delete_one({"_id": ObjectId(item_id)})
    
    await db.restaurants.update_one(
        {"_id": current_restaurant["_id"]},
        {"$inc": {"menu_count": -1}}
    )
    
    return {"message": "Menu item deleted"}

@router.patch("/menu/{item_id}/toggle")
async def toggle_menu_availability(
    item_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Toggle menu item availability"""
    db = get_database()
    
    menu_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})
    
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    if menu_item["restaurant_id"] != str(current_restaurant["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_status = not menu_item.get("is_available", True)
    
    await db.menu_items.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"is_available": new_status}}
    )
    
    return {"success": True, "is_available": new_status}

# ==================== SEARCH RESTAURANTS (For Tagging) ====================

@router.get("/search/restaurants")
async def search_restaurants_for_tagging(
    q: str,
    limit: int = 5
):
    """Search restaurants by name for tagging in user posts (public)"""
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

# ==================== RESTAURANT REVIEWS (Tagged Posts) ====================

@router.get("/reviews/{restaurant_id}")
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
            # ADD THESE NEW FIELDS FOR RESTAURANT REPLY
            "restaurant_reply": post.get("restaurant_reply"),
            "restaurant_reply_at": post.get("restaurant_reply_at").isoformat() if post.get("restaurant_reply_at") else None,
            "created_at": post["created_at"].isoformat() if isinstance(post.get("created_at"), datetime) else post.get("created_at", ""),
        })
    
    # Update reviews count on restaurant
    reviews_count = await db.posts.count_documents({"tagged_restaurant_id": restaurant_id})
    await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$set": {"reviews_count": reviews_count}}
    )
    
    return result

# ==================== RESTAURANT REPLY TO REVIEWS ====================

@router.post("/reviews/{review_id}/reply")
async def reply_to_review(
    review_id: str,
    reply_data: dict,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Restaurant owner replies to a customer review (tagged post)"""
    db = get_database()
    
    reply_text = reply_data.get("reply_text")
    
    if not reply_text or not reply_text.strip():
        raise HTTPException(status_code=400, detail="Reply text is required")
    
    # Find the review (which is a post tagged with this restaurant)
    try:
        post = await db.posts.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Verify this review is for the current restaurant
    if post.get("tagged_restaurant_id") != str(current_restaurant["_id"]):
        raise HTTPException(
            status_code=403, 
            detail="You can only reply to reviews for your restaurant"
        )
    
    # Update the post with the restaurant's reply
    result = await db.posts.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$set": {
                "restaurant_reply": reply_text.strip(),
                "restaurant_reply_at": datetime.utcnow(),
                "restaurant_reply_by": str(current_restaurant["_id"])
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Failed to save reply")
    
    print(f"✅ Restaurant {current_restaurant['_id']} replied to review {review_id}")
    
    return {
        "success": True,
        "message": "Reply sent successfully"
    }


@router.put("/reviews/{review_id}/reply")
async def update_review_reply(
    review_id: str,
    reply_data: dict,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Update restaurant's reply to a review"""
    db = get_database()
    
    reply_text = reply_data.get("reply_text")
    
    if not reply_text or not reply_text.strip():
        raise HTTPException(status_code=400, detail="Reply text is required")
    
    # Find the review
    try:
        post = await db.posts.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Verify ownership
    if post.get("tagged_restaurant_id") != str(current_restaurant["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update the reply
    await db.posts.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$set": {
                "restaurant_reply": reply_text.strip(),
                "restaurant_reply_updated_at": datetime.utcnow()
            }
        }
    )
    
    return {"success": True, "message": "Reply updated successfully"}


@router.delete("/reviews/{review_id}/reply")
async def delete_review_reply(
    review_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Delete restaurant's reply to a review"""
    db = get_database()
    
    # Find the review
    try:
        post = await db.posts.find_one({"_id": ObjectId(review_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid review ID")
    
    if not post:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Verify ownership
    if post.get("tagged_restaurant_id") != str(current_restaurant["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Remove the reply
    await db.posts.update_one(
        {"_id": ObjectId(review_id)},
        {
            "$unset": {
                "restaurant_reply": "",
                "restaurant_reply_at": "",
                "restaurant_reply_by": "",
                "restaurant_reply_updated_at": ""
            }
        }
    )
    
    return {"success": True, "message": "Reply deleted successfully"}

# ==================== FOLLOW/UNFOLLOW RESTAURANT ====================

@router.post("/follow/{restaurant_id}")
async def follow_restaurant_public(
    restaurant_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Follow a restaurant (for regular users)"""
    db = get_database()
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check if restaurant exists
    try:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid restaurant ID")
    
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Check if already following
    existing_follow = await db.follows.find_one({
        "followerId": user_id,
        "followingId": restaurant_id,
        "followingType": "restaurant"
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this restaurant")
    
    # Create follow record
    follow_doc = {
        "followerId": user_id,
        "followingId": restaurant_id,
        "followingType": "restaurant",
        "created_at": datetime.utcnow()
    }
    await db.follows.insert_one(follow_doc)
    
    # Update restaurant's followers count
    await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$inc": {"followers_count": 1}}
    )
    
    print(f"✅ User {user_id} followed restaurant {restaurant_id}")
    
    return {"message": "Successfully followed restaurant"}


@router.delete("/follow/{restaurant_id}")
async def unfollow_restaurant_public(
    restaurant_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Unfollow a restaurant (for regular users)"""
    db = get_database()
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Remove follow record
    result = await db.follows.delete_one({
        "followerId": user_id,
        "followingId": restaurant_id,
        "followingType": "restaurant"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this restaurant")
    
    # Update restaurant's followers count
    await db.restaurants.update_one(
        {"_id": ObjectId(restaurant_id)},
        {"$inc": {"followers_count": -1}}
    )
    
    print(f"✅ User {user_id} unfollowed restaurant {restaurant_id}")
    
    return {"message": "Successfully unfollowed restaurant"}

# ==================== LIKES FOR REGULAR USERS ====================

@router.post("/public/{post_id}/like")
async def like_restaurant_post_as_user(
    post_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Like a restaurant post (for regular users)"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Check if already liked
    existing_like = await db.restaurant_likes.find_one({
        "post_id": post_id,
        "user_id": user_id,
        "user_type": "user"
    })
    
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked this post")
    
    # Add like
    await db.restaurant_likes.insert_one({
        "post_id": post_id,
        "user_id": user_id,
        "user_type": "user",
        "created_at": datetime.utcnow()
    })
    
    # Update post likes count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": 1}}
    )
    
    return {"message": "Post liked"}


@router.delete("/public/{post_id}/like")
async def unlike_restaurant_post_as_user(
    post_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Unlike a restaurant post (for regular users)"""
    db = get_database()
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    result = await db.restaurant_likes.delete_one({
        "post_id": post_id,
        "user_id": user_id,
        "user_type": "user"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Like not found")
    
    # Update post likes count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"likes_count": -1}}
    )
    
    return {"message": "Post unliked"}

# ==================== COMMENTS FOR REGULAR USERS ====================

@router.post("/public/{post_id}/comment")
async def add_comment_to_restaurant_post_as_user(
    post_id: str,
    comment_text: str = Form(...),
    current_user: dict = Depends(get_current_user_optional)
):
    """Add a comment to a restaurant post (for regular users)"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    comment_doc = {
        "post_id": post_id,
        "user_id": user_id,
        "user_type": "user",
        "username": current_user.get("full_name") or current_user.get("username"),
        "profile_pic": current_user.get("profile_picture"),
        "level": current_user.get("level", 1),
        "comment_text": comment_text.strip(),
        "created_at": datetime.utcnow()
    }
    
    result = await db.restaurant_comments.insert_one(comment_doc)
    
    # Update post comments count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"comments_count": 1}}
    )
    
    print(f"✅ User {user_id} commented on restaurant post {post_id}")
    
    return {
        "message": "Comment added",
        "comment_id": str(result.inserted_id)
    }


@router.get("/public/{post_id}/comments")
async def get_restaurant_post_comments_public(post_id: str):
    """Get all comments for a restaurant post (public - no auth required)"""
    db = get_database()
    
    # Check if post exists
    post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comments = await db.restaurant_comments.find({"post_id": post_id}).sort("created_at", -1).to_list(100)
    
    result = []
    for comment in comments:
        # Get user info based on user_type
        user_type = comment.get("user_type", "restaurant")
        
        if user_type == "user":
            # Regular user comment
            user = await db.users.find_one({"_id": ObjectId(comment["user_id"])})
            result.append({
                "id": str(comment["_id"]),
                "post_id": post_id,
                "user_id": comment["user_id"],
                "user_type": "user",
                "username": user.get("full_name") if user else comment.get("username", "Unknown"),
                "profile_pic": user.get("profile_picture") if user else comment.get("profile_pic"),
                "level": user.get("level", 1) if user else comment.get("level", 1),
                "comment_text": comment["comment_text"],
                "created_at": comment["created_at"]
            })
        else:
            # Restaurant comment
            restaurant = await db.restaurants.find_one({"_id": ObjectId(comment.get("restaurant_id", comment.get("user_id")))})
            result.append({
                "id": str(comment["_id"]),
                "post_id": post_id,
                "user_id": comment.get("restaurant_id", comment.get("user_id")),
                "user_type": "restaurant",
                "username": restaurant.get("restaurant_name") if restaurant else comment.get("restaurant_name", "Unknown"),
                "profile_pic": restaurant.get("profile_picture") if restaurant else comment.get("profile_pic"),
                "level": None,
                "comment_text": comment["comment_text"],
                "created_at": comment["created_at"]
            })
    
    return result


@router.delete("/public/{post_id}/comment/{comment_id}")
async def delete_comment_from_restaurant_post_as_user(
    post_id: str,
    comment_id: str,
    current_user: dict = Depends(get_current_user_optional)
):
    """Delete a comment from a restaurant post (for regular users - only own comments)"""
    db = get_database()
    
    user_id = str(current_user.get("_id") or current_user.get("id"))
    
    # Find and verify ownership
    comment = await db.restaurant_comments.find_one({
        "_id": ObjectId(comment_id),
        "post_id": post_id
    })
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user owns this comment
    if comment.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    # Delete comment
    result = await db.restaurant_comments.delete_one({"_id": ObjectId(comment_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Failed to delete comment")
    
    # Update post comments count
    await db.restaurant_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"comments_count": -1}}
    )
    
    return {"message": "Comment deleted"}