from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from bson import ObjectId
import os
import uuid
from typing import List, Optional
from pydantic import BaseModel

from database import get_database
from routers.auth import get_current_user
from config import settings
from utils.moderation import check_image_moderation, save_moderation_result
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body, Query

router = APIRouter(prefix="/api/stories", tags=["stories"])

class ShareStoryRequest(BaseModel):
    story_id: str

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
    location_name: Optional[str] = Query(None),
    map_link: Optional[str] = Query(None),
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
        file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
        unique_filename = f"story_{current_user['_id']}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # ======================================================
        # VIDEO OPTIMIZATION - Convert MOV to MP4 and optimize Android MP4
        # ======================================================
        if media_type == "video":
            from utils.video_transcode import optimize_video_with_thumbnail
            
            video_source = "iOS MOV" if file_ext == "mov" or file.content_type == "video/quicktime" else "Android/Other MP4"
            print(f"🎬 Story video detected ({video_source}) - converting/optimizing to 720p H.264 MP4...")
            
            try:
                # Optimize video to 720p and generate thumbnail
                video_path, thumbnail_path = await optimize_video_with_thumbnail(file_path)
                
                # Update file_path and filename to point to the optimized file
                file_path = video_path
                unique_filename = os.path.basename(video_path)
                
                print(f"✅ Story video converted/optimized to 720p MP4: {unique_filename}")
            except Exception as e:
                print(f"❌ Story video optimization failed: {str(e)}")
                import traceback
                traceback.print_exc()
                # Clean up and fail
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
                print(f"🚫 BANNED CONTENT DETECTED (Story) - User: {current_user.get('full_name', 'Unknown')} (ID: {current_user['_id']})")
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
                        story_id=None  # No story created - upload was blocked
                    )
                
                # Block the upload - return error to user
                raise HTTPException(
                    status_code=400,
                    detail=f"Content not allowed: {moderation_response.reason or 'Banned content detected. Image contains nudity, alcohol, or other prohibited content.'}"
                )
            
            # Save moderation result for allowed content
            if moderation_response.moderation_result:
                moderation_result = moderation_response.moderation_result
        # Note: For videos, moderation is optional
        
        # Create story document
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)
        
        story_doc = {
            "user_id": str(current_user["_id"]),
            "media_url": f"/api/static/uploads/{unique_filename}",
            "media_type": media_type,
            "created_at": now,
            "expires_at": expires_at,
            "location_name": location_name if location_name else None,
            "map_link": map_link if map_link else None,
        }
        
        result = await db.stories.insert_one(story_doc)
        story_id = str(result.inserted_id)
        story_doc["_id"] = story_id
        
        # Save moderation result with story_id
        if moderation_result:
            await save_moderation_result(
                db=db,
                moderation_result=moderation_result,
                story_id=story_id
            )
        
        return {
            "message": "Story uploaded successfully",
            "story": {
                "id": story_id,
                "user_id": story_doc["user_id"],
                "media_url": story_doc["media_url"],
                "media_type": story_doc["media_type"],
                "created_at": story_doc["created_at"].isoformat(),
                "expires_at": story_doc["expires_at"].isoformat(),
                "location_name": story_doc.get("location_name"),
                "map_link": story_doc.get("map_link"),
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
        # Check both field name formats (camelCase and snake_case) for compatibility
        follows = await db.follows.find({
            "$or": [
                {"followerId": current_user_id},
                {"follower_id": current_user_id}
            ]
        }).to_list(None)
        
        # Extract following IDs from either field name format
        following_ids = []
        for follow in follows:
            following_id = follow.get("followingId") or follow.get("following_id")
            if following_id:
                following_ids.append(following_id)
        
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
                # Get view counts for each story
                formatted_stories = []
                for s in user_stories:
                    story_id = str(s["_id"])
                    # Get view count for this story
                    view_count = await db.story_views.count_documents({"story_id": story_id})
                    # Get year from created_at
                    created_year = s["created_at"].year
                    # Calculate story length (24 hours for all stories, or video duration if available)
                    story_length_seconds = 5 if s["media_type"] == "image" else 30  # Default: 5s for images, 30s for videos
                    
                    story_data = {
                        "id": story_id,
                        "media_url": s["media_url"],
                        "media_type": s["media_type"],
                        "created_at": s["created_at"].isoformat(),
                        "expires_at": s["expires_at"].isoformat(),
                        "view_count": view_count,
                        "year": created_year,
                        "story_length": story_length_seconds,
                        "location_name": s.get("location_name"),
                        "map_link": s.get("map_link"),
                    }
                    
                    # Include shared story information if it's a shared story
                    if s.get("is_shared"):
                        story_data["is_shared"] = True
                        story_data["shared_from"] = s.get("shared_from")
                    
                    formatted_stories.append(story_data)
                    
                    # Include shared story information if it's a shared story
                    if s.get("is_shared"):
                        story_data["is_shared"] = True
                        story_data["shared_from"] = s.get("shared_from")
                    
                    formatted_stories.append(story_data)
                
                result.append({
                    "user": {
                        "id": str(user["_id"]),
                        "username": user.get("username", user.get("full_name", "Unknown")),
                        "full_name": user.get("full_name", "Unknown"),
                        "profile_picture": user.get("profile_picture"),
                        "level": user.get("level", 1),
                    },
                    "stories": formatted_stories
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

@router.post("/create-from-post")
async def create_story_from_post(
    post_id: str = Body(...),
    media_url: str = Body(...),
    review: str = Body(""),
    rating: int = Body(0),
    location: str = Body(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a story directly from a Post (Add To Story button)
    No file upload required.
    """
    try:
        db = get_database()

        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)

        # Prepare story doc
        story_doc = {
            "user_id": str(current_user["_id"]),
            "media_url": media_url,
            "media_type": "image", 
            "created_at": now,
            "expires_at": expires_at,
            "from_post": {
                "post_id": post_id,
                "review": review,
                "rating": rating,
                "location": location,
            }
        }

        result = await db.stories.insert_one(story_doc)
        story_id = str(result.inserted_id)

        return {
            "message": "Story created from post",
            "story": {
                "id": story_id,
                "media_url": media_url,
                "media_type": "image",
                "created_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "from_post": story_doc["from_post"]
            }
        }

    except Exception as e:
        print("❌ Error creating story from post:", e)
        raise HTTPException(status_code=500, detail="Failed to create story")

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
        
        # Get view counts and additional info for each story
        formatted_stories = []
        for s in stories:
            story_id = str(s["_id"])
            # Get view count for this story
            view_count = await db.story_views.count_documents({"story_id": story_id})
            # Get year from created_at
            created_year = s["created_at"].year
            # Calculate story length (5s for images, 30s for videos)
            story_length_seconds = 5 if s["media_type"] == "image" else 30
            
            story_data = {
                "id": story_id,
                "media_url": s["media_url"],
                "media_type": s["media_type"],
                "created_at": s["created_at"].isoformat(),
                "expires_at": s["expires_at"].isoformat(),
                "view_count": view_count,
                "year": created_year,
                "story_length": story_length_seconds,
                "location_name": s.get("location_name"),
                "map_link": s.get("map_link"),
            }
            
            # Include shared story information if it's a shared story
            if s.get("is_shared"):
                story_data["is_shared"] = True
                story_data["shared_from"] = s.get("shared_from")
            
            formatted_stories.append(story_data)
        
        return {
            "user": {
                "id": str(user["_id"]),
                "username": user.get("username", user.get("full_name", "Unknown")),
                "full_name": user.get("full_name", "Unknown"),
                "profile_picture": user.get("profile_picture"),
                "level": user.get("level", 1),
            },
            "stories": formatted_stories
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


@router.post("/{story_id}/view")
async def mark_story_viewed(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a story as viewed by the current user
    Tracks who viewed the story (Instagram-like)
    """
    try:
        db = get_database()
        viewer_id = str(current_user["_id"])
        
        # Check if story exists
        story = await db.stories.find_one({"_id": ObjectId(story_id)})
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Don't count views from the story owner
        if story["user_id"] == viewer_id:
            return {"message": "Story owner view not counted", "view_count": 0}
        
        # Check if user already viewed this story
        existing_view = await db.story_views.find_one({
            "story_id": story_id,
            "viewer_id": viewer_id
        })
        
        if existing_view:
            # User already viewed, return current count
            view_count = await db.story_views.count_documents({"story_id": story_id})
            return {"message": "Already viewed", "view_count": view_count}
        
        # Record the view
        view_doc = {
            "story_id": story_id,
            "viewer_id": viewer_id,
            "viewed_at": datetime.utcnow()
        }
        
        await db.story_views.insert_one(view_doc)
        
        # Get updated view count
        view_count = await db.story_views.count_documents({"story_id": story_id})
        
        return {
            "message": "Story viewed",
            "view_count": view_count
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error marking story as viewed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to mark story as viewed: {str(e)}")


@router.get("/{story_id}/views")
async def get_story_views(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get view count and list of viewers for a story
    Only story owner can see the full list
    """
    try:
        db = get_database()
        current_user_id = str(current_user["_id"])
        
        # Check if story exists
        story = await db.stories.find_one({"_id": ObjectId(story_id)})
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Get view count
        view_count = await db.story_views.count_documents({"story_id": story_id})
        
        # Only story owner can see viewer details
        is_owner = story["user_id"] == current_user_id
        
        if is_owner:
            # Get list of viewers with user details
            views = await db.story_views.find({"story_id": story_id}).sort("viewed_at", -1).to_list(100)
            
            viewer_details = []
            for view in views:
                viewer = await db.users.find_one({"_id": ObjectId(view["viewer_id"])})
                if viewer:
                    has_liked = await db.story_likes.find_one({
                        "story_id": story_id,
                        "user_id": view["viewer_id"]
                    }) is not None
                    
                    full_name = viewer.get("full_name", "")
                    username = viewer.get("username", "")
                    display_name = full_name or username or "Unknown"
                    
                    viewer_details.append({
                        "user_id": view["viewer_id"],
                        "username": display_name,
                        "full_name": full_name,
                        "profile_picture": viewer.get("profile_picture"),
                        "viewed_at": view["viewed_at"].isoformat(),
                        "has_liked": has_liked
                    })
            
            return {
                "view_count": view_count,
                "viewers": viewer_details,
                "is_owner": True
            }
        else:
            return {
                "view_count": view_count,
                "viewers": [],
                "is_owner": False
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting story views: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get story views: {str(e)}")

@router.post("/{story_id}/share")
async def share_story(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Share/repost someone else's story to your own story
    Creates a new story that references the original
    """
    try:
        db = get_database()
        current_user_id = str(current_user["_id"])
        
        # Check if original story exists and is not expired
        original_story = await db.stories.find_one({"_id": ObjectId(story_id)})
        if not original_story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Check if story is expired
        if original_story["expires_at"] < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Cannot share expired story")
        
        # Don't allow sharing your own story
        if original_story["user_id"] == current_user_id:
            raise HTTPException(status_code=400, detail="Cannot share your own story")
        
        # Get original story owner details
        original_user = await db.users.find_one({"_id": ObjectId(original_story["user_id"])})
        if not original_user:
            raise HTTPException(status_code=404, detail="Original story owner not found")
        
        # Get follower count for original user
        follower_count = await db.follows.count_documents({"following_id": original_story["user_id"]})
        
        # Create shared story document
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=24)
        
        shared_story_doc = {
            "user_id": current_user_id,
            "media_url": original_story["media_url"],
            "media_type": original_story["media_type"],
            "created_at": now,
            "expires_at": expires_at,
            "is_shared": True,
            "original_story_id": story_id,
            "shared_from": {
                "user_id": original_story["user_id"],
                "username": original_user.get("username", original_user.get("full_name", "Unknown")),
                "full_name": original_user.get("full_name", "Unknown"),
                "profile_picture": original_user.get("profile_picture"),
                "follower_count": follower_count
            }
        }
        
        result = await db.stories.insert_one(shared_story_doc)
        shared_story_id = str(result.inserted_id)
        shared_story_doc["_id"] = shared_story_id
        
        return {
            "message": "Story shared successfully",
            "story": {
                "id": shared_story_id,
                "user_id": shared_story_doc["user_id"],
                "media_url": shared_story_doc["media_url"],
                "media_type": shared_story_doc["media_type"],
                "created_at": shared_story_doc["created_at"].isoformat(),
                "expires_at": shared_story_doc["expires_at"].isoformat(),
                "is_shared": True,
                "shared_from": shared_story_doc["shared_from"]
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error sharing story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to share story: {str(e)}")

# ==================== STORY LIKE ENDPOINTS ====================

@router.get("/{story_id}/like-status")
async def get_story_like_status(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if current user has liked this story"""
    try:
        db = get_database()
        
        like = await db.story_likes.find_one({
            "story_id": story_id,
            "user_id": str(current_user["_id"])
        })
        
        like_count = await db.story_likes.count_documents({"story_id": story_id})
        
        return {
            "is_liked": like is not None,
            "like_count": like_count
        }
    except Exception as e:
        print(f"❌ Error checking story like status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to check like status: {str(e)}")


@router.post("/{story_id}/like")
async def like_story(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Like a story"""
    try:
        db = get_database()
        
        # Check if story exists
        story = await db.stories.find_one({"_id": ObjectId(story_id)})
        if not story:
            raise HTTPException(status_code=404, detail="Story not found")
        
        # Check if already liked
        existing = await db.story_likes.find_one({
            "story_id": story_id,
            "user_id": str(current_user["_id"])
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Already liked this story")
        
        # Add like
        await db.story_likes.insert_one({
            "story_id": story_id,
            "user_id": str(current_user["_id"]),
            "story_owner_id": story["user_id"],
            "created_at": datetime.utcnow()
        })
        
        # Send push notification to story owner (optional)
        if story["user_id"] != str(current_user["_id"]):
            try:
                from routers.notifications import create_notification
                await create_notification(
                    db=db,
                    notification_type="story_like",
                    from_user_id=str(current_user["_id"]),
                    to_user_id=story["user_id"],
                    message=f"{current_user.get('full_name', 'Someone')} liked your story"
                )
            except Exception as notif_error:
                print(f"⚠️ Failed to send story like notification: {notif_error}")
        
        return {"message": "Story liked"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error liking story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to like story: {str(e)}")


@router.delete("/{story_id}/like")
async def unlike_story(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlike a story"""
    try:
        db = get_database()
        
        result = await db.story_likes.delete_one({
            "story_id": story_id,
            "user_id": str(current_user["_id"])
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=400, detail="Like not found")
        
        return {"message": "Story unliked"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error unliking story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to unlike story: {str(e)}")


