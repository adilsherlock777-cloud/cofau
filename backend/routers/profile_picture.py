from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from datetime import datetime
from bson import ObjectId
import os
import shutil
import glob
from database import get_database
from routers.auth import get_current_user
from config import settings
from utils.moderation import check_image_moderation, save_moderation_result

router = APIRouter(prefix="/api/users", tags=["profile_picture"])

# Use same upload directory as feed images - ensure absolute path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend directory
if not os.path.isabs(settings.UPLOAD_DIR):
    UPLOAD_DIR = os.path.join(BASE_DIR, settings.UPLOAD_DIR)
else:
    UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload or update user's profile picture"""

    db = get_database()
    user_id = str(current_user["_id"])

    # ✅ Fetch latest user data from database to get current profile_picture
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"profile_{user_id}_{timestamp}.{file_extension}"

    # Final file location
    file_path = os.path.join(UPLOAD_DIR, filename)

    # -------------------------------------------------------------
    # DELETE OLD PROFILE PICTURE(S) IF EXISTS
    # -------------------------------------------------------------
    # First, try to delete the profile picture stored in database
    old_profile_pic = user_doc.get("profile_picture")
    
    # Also find and delete ALL old profile pictures for this user
    # This ensures we clean up any orphaned files
    all_old_profile_files = glob.glob(os.path.join(UPLOAD_DIR, f"profile_{user_id}_*"))
    
    if old_profile_pic:
        # Handle various URL formats to extract the filename
        old_filename = None
        old_path = None
        
        # Remove any query parameters or fragments
        old_profile_pic_clean = old_profile_pic.split("?")[0].split("#")[0]
        
        # Handle different URL formats:
        # 1. Full URL: https://backend.cofau.com/api/static/uploads/xxx.jpg
        # 2. Relative with /api/static/uploads/: /api/static/uploads/xxx.jpg
        # 3. Relative with /legacy-static/: /legacy-static/uploads/profile_pictures/xxx.jpg
        # 4. Just filename: xxx.jpg
        
        if "/api/static/uploads/" in old_profile_pic_clean:
            # Extract filename from /api/static/uploads/xxx.jpg
            old_filename = old_profile_pic_clean.split("/api/static/uploads/")[-1]
        elif "/legacy-static/" in old_profile_pic_clean:
            # Extract filename from /legacy-static/uploads/profile_pictures/xxx.jpg
            old_filename = old_profile_pic_clean.split("/")[-1]
        elif old_profile_pic_clean.startswith("http"):
            # Full URL - extract the last part after the last /
            old_filename = old_profile_pic_clean.split("/")[-1]
        else:
            # Assume it's just a filename
            old_filename = old_profile_pic_clean.split("/")[-1]
        
        if old_filename:
            old_path = os.path.join(UPLOAD_DIR, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"🗑️ Deleted old profile picture: {old_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete old profile picture: {e}")
            else:
                print(f"⚠️ Old profile picture file not found at: {old_path}")
                print(f"   Looking for filename: {old_filename}")
                print(f"   Upload directory: {UPLOAD_DIR}")
                
                # Try to find the file with different path variations
                # Search for files starting with profile_ and user_id
                search_patterns = [
                    os.path.join(UPLOAD_DIR, f"profile_{user_id}_*"),
                    os.path.join(UPLOAD_DIR, f"*{old_filename}"),
                    os.path.join(UPLOAD_DIR, old_filename),
                ]
                
                found_file = None
                for pattern in search_patterns:
                    matching_files = glob.glob(pattern)
                    if matching_files:
                        # Find the one that's not the new file we're about to create
                        for match in matching_files:
                            if match != file_path:
                                found_file = match
                                break
                        if found_file:
                            break
                
                if found_file:
                    try:
                        os.remove(found_file)
                        print(f"🗑️ Deleted old profile picture (found via search): {found_file}")
                    except Exception as e:
                        print(f"⚠️ Failed to delete found profile picture: {e}")
                else:
                    print(f"⚠️ Could not find old profile picture file to delete")
    
    # Delete ALL old profile pictures for this user (cleanup orphaned files)
    if all_old_profile_files:
        deleted_count = 0
        for old_file in all_old_profile_files:
            # Don't delete the new file we're about to create
            if old_file != file_path:
                try:
                    os.remove(old_file)
                    deleted_count += 1
                    print(f"🗑️ Deleted old profile picture: {old_file}")
                except Exception as e:
                    print(f"⚠️ Failed to delete old profile picture {old_file}: {e}")
        
        if deleted_count > 0:
            print(f"✅ Cleaned up {deleted_count} old profile picture file(s) for user {user_id}")

    # -------------------------------------------------------------
    # SAVE NEW FILE
    # -------------------------------------------------------------
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"✅ Saved profile picture: {file_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # -------------------------------------------------------------
    # CONTENT MODERATION - Check for banned content
    # -------------------------------------------------------------
    moderation_response = check_image_moderation(
        file_path=file_path,
        user_id=user_id
    )
    
    if not moderation_response.allowed:
        # ❌ BANNED CONTENT DETECTED - Delete file immediately (NOT uploaded to server)
        print(f"🚫 BANNED CONTENT DETECTED (Profile Picture) - User: {user_id}")
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
                post_id=None,
                story_id=None
            )
        
        # Block the upload - return error to user
        raise HTTPException(
            status_code=400,
            detail=f"Content not allowed: {moderation_response.reason or 'Banned content detected. Image contains nudity, alcohol, or other prohibited content.'}"
        )
    
    # Save moderation result for allowed content
    if moderation_response.moderation_result:
        await save_moderation_result(
            db=db,
            moderation_result=moderation_response.moderation_result,
            post_id=None,
            story_id=None
        )

    # -------------------------------------------------------------
    # PUBLIC URL (Frontend will use this) - Use same format as feed images
    # -------------------------------------------------------------
    profile_image_url = f"/api/static/uploads/{filename}"

    # DB update
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile_picture": profile_image_url}}
    )

    print(f"📸 Updated profile picture for user {user_id}")

    return {
        "message": "Profile picture uploaded successfully",
        "profile_image_url": profile_image_url
    }


@router.delete("/profile-image")
async def delete_profile_image(current_user: dict = Depends(get_current_user)):
    """Remove user's profile picture"""

    db = get_database()
    user_id = str(current_user["_id"])

    old_profile_pic = current_user.get("profile_picture")

    if old_profile_pic:
        # Handle various URL formats to extract the filename
        old_filename = None
        old_path = None
        
        # Remove any query parameters or fragments
        old_profile_pic_clean = old_profile_pic.split("?")[0].split("#")[0]
        
        # Handle different URL formats:
        # 1. Full URL: https://backend.cofau.com/api/static/uploads/xxx.jpg
        # 2. Relative with /api/static/uploads/: /api/static/uploads/xxx.jpg
        # 3. Relative with /legacy-static/: /legacy-static/uploads/profile_pictures/xxx.jpg
        # 4. Just filename: xxx.jpg
        
        if "/api/static/uploads/" in old_profile_pic_clean:
            # Extract filename from /api/static/uploads/xxx.jpg
            old_filename = old_profile_pic_clean.split("/api/static/uploads/")[-1]
        elif "/legacy-static/" in old_profile_pic_clean:
            # Extract filename from /legacy-static/uploads/profile_pictures/xxx.jpg
            old_filename = old_profile_pic_clean.split("/")[-1]
        elif old_profile_pic_clean.startswith("http"):
            # Full URL - extract the last part after the last /
            old_filename = old_profile_pic_clean.split("/")[-1]
        else:
            # Assume it's just a filename
            old_filename = old_profile_pic_clean.split("/")[-1]
        
        if old_filename:
            old_path = os.path.join(UPLOAD_DIR, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                    print(f"🗑️ Deleted profile picture file: {old_path}")
                except Exception as e:
                    print(f"⚠️ Failed to delete profile picture: {e}")
            else:
                print(f"⚠️ Profile picture file not found: {old_path}")

    # Remove from DB
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile_picture": None}}
    )

    return {
        "message": "Profile picture removed successfully",
        "profile_image_url": None
    }
