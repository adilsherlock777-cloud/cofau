from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from bson import ObjectId
import os
import uuid
from typing import List

from database import get_database
from routers.auth import get_current_user
from config import settings

router = APIRouter(prefix="/api/stories", tags=["stories"])

# Use same upload directory as feed images - ensure absolute path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend directory
if not os.path.isabs(settings.UPLOAD_DIR):
    UPLOAD_DIR = os.path.join(BASE_DIR, settings.UPLOAD_DIR)
else:
    UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_story(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a new story (image or video)
    - Saves file to static/uploads/ (same as feed images)
    - Sets expiration to 24 hours from now
    - Returns story object
    """
    try:
        db = get_database()
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4", "video/quicktime"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Only images and videos allowed.")
        
        # Determine media type
        media_type = "image" if file.content_type.startswith("image") else "video"
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        unique_filename = f"story_{current_user['_id']}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Create story document
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)
        
        story_doc = {
            "user_id": str(current_user["_id"]),
            "media_url": f"/api/static/uploads/{unique_filename}",
            "media_type": media_type,
            "created_at": now,
            "expires_at": expires_at,
        }
        
        result = await db.stories.insert_one(story_doc)
        story_doc["_id"] = str(result.inserted_id)
        
        return {
            "message": "Story uploaded successfully",
            "story": {
                "id": str(result.inserted_id),
                "user_id": story_doc["user_id"],
                "media_url": story_doc["media_url"],
                "media_type": story_doc["media_type"],
                "created_at": story_doc["created_at"].isoformat(),
                "expires_at": story_doc["expires_at"].isoformat(),
            }
        }
    
    except Exception as e:
        print(f"❌ Error uploading story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload story: {str(e)}")


@router.get("/feed")
async def get_stories_feed(
    current_user: dict = Depends(get_current_user)
):
    """
    Get stories feed for the current user
    Returns stories from:
    - Users the current user follows
    - The current user's own stories
    
    Format: Grouped by user
    """
    try:
        db = get_database()
        now = datetime.utcnow()
        current_user_id = str(current_user["_id"])
        
        # Get list of users the current user follows
        follows = await db.follows.find({"follower_id": current_user_id}).to_list(None)
        following_ids = [follow["following_id"] for follow in follows]
        
        # Include current user in the list
        user_ids = [current_user_id] + following_ids
        
        # Get all non-expired stories from these users
        stories = await db.stories.find({
            "user_id": {"$in": user_ids},
            "expires_at": {"$gt": now}
        }).sort("created_at", -1).to_list(None)
        
        # Group stories by user
        user_stories_map = {}
        for story in stories:
            user_id = story["user_id"]
            if user_id not in user_stories_map:
                user_stories_map[user_id] = []
            user_stories_map[user_id].append(story)
        
        # Fetch user details and format response
        result = []
        for user_id, user_stories in user_stories_map.items():
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                result.append({
                    "user": {
                        "id": str(user["_id"]),
                        "username": user.get("username", user.get("full_name", "Unknown")),
                        "full_name": user.get("full_name", "Unknown"),
                        "profile_picture": user.get("profile_picture"),
                        "level": user.get("level", 1),
                    },
                    "stories": [
                        {
                            "id": str(s["_id"]),
                            "media_url": s["media_url"],
                            "media_type": s["media_type"],
                            "created_at": s["created_at"].isoformat(),
                            "expires_at": s["expires_at"].isoformat(),
                        }
                        for s in user_stories
                    ]
                })
        
        # Sort: current user first, then by most recent story
        result.sort(key=lambda x: (
            x["user"]["id"] != current_user_id,  # Current user first
            -datetime.fromisoformat(x["stories"][0]["created_at"]).timestamp() if x["stories"] else 0
        ))
        
        return result
    
    except Exception as e:
        print(f"❌ Error fetching stories feed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch stories: {str(e)}")


@router.get("/user/{user_id}")
async def get_user_stories(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all non-expired stories for a specific user
    """
    try:
        db = get_database()
        now = datetime.utcnow()
        
        stories = await db.stories.find({
            "user_id": user_id,
            "expires_at": {"$gt": now}
        }).sort("created_at", 1).to_list(None)
        
        # Get user details
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username", user.get("full_name", "Unknown")),
                "full_name": user.get("full_name", "Unknown"),
                "profile_picture": user.get("profile_picture"),
                "level": user.get("level", 1),
            },
            "stories": [
                {
                    "id": str(s["_id"]),
                    "media_url": s["media_url"],
                    "media_type": s["media_type"],
                    "created_at": s["created_at"].isoformat(),
                    "expires_at": s["expires_at"].isoformat(),
                }
                for s in stories
            ]
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching user stories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user stories: {str(e)}")


@router.delete("/{story_id}")
async def delete_story(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a story (only owner can delete)
    """
    try:
        db = get_database()
        # Find story
        story = await db.stories.find_one({"_id": ObjectId(story_id)})
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Check ownership
        if story["user_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="You can only delete your own stories")
        
        # Delete file from filesystem
        if story.get("media_url"):
            # Handle both old and new URL formats
            filename = None
            if "/api/static/stories/" in story["media_url"]:
                # Old format: /api/static/stories/filename
                filename = story["media_url"].replace("/api/static/stories/", "")
            elif "/api/static/uploads/" in story["media_url"]:
                # New format: /api/static/uploads/filename
                filename = story["media_url"].replace("/api/static/uploads/", "")
            
            if filename:
                full_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(full_path):
                    os.remove(full_path)
        
        # Delete from database
        await db.stories.delete_one({"_id": ObjectId(story_id)})
        
        return {"message": "Story deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete story: {str(e)}")


@router.delete("/expired/cleanup")
async def cleanup_expired_stories(
    current_user: dict = Depends(get_current_user)
):
    """
    Remove expired stories (admin/cron endpoint)
    """
    try:
        db = get_database()
        now = datetime.utcnow()
        
        # Find expired stories
        expired_stories = await db.stories.find({"expires_at": {"$lt": now}}).to_list(None)
        
        # Delete files and database records
        deleted_count = 0
        for story in expired_stories:
            # Delete file
            if story.get("media_url"):
                # Handle both old and new URL formats
                filename = None
                if "/api/static/stories/" in story["media_url"]:
                    # Old format: /api/static/stories/filename
                    filename = story["media_url"].replace("/api/static/stories/", "")
                elif "/api/static/uploads/" in story["media_url"]:
                    # New format: /api/static/uploads/filename
                    filename = story["media_url"].replace("/api/static/uploads/", "")
                
                if filename:
                    full_path = os.path.join(UPLOAD_DIR, filename)
                    if os.path.exists(full_path):
                        os.remove(full_path)
            
            # Delete from database
            await db.stories.delete_one({"_id": story["_id"]})
            deleted_count += 1
        
        return {
            "message": f"Cleaned up {deleted_count} expired stories",
            "deleted_count": deleted_count
        }
    
    except Exception as e:
        print(f"❌ Error cleaning up expired stories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup stories: {str(e)}")
