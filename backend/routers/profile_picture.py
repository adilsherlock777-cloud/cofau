from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from datetime import datetime
from bson import ObjectId
import os
import shutil
from database import get_database
from routers.auth import get_current_user
from config import settings

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

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Generate unique filename
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    user_id = str(current_user["_id"])
    filename = f"profile_{user_id}_{timestamp}.{file_extension}"

    # Final file location
    file_path = os.path.join(UPLOAD_DIR, filename)

    # -------------------------------------------------------------
    # DELETE OLD PROFILE PICTURE IF EXISTS
    # -------------------------------------------------------------
    old_profile_pic = current_user.get("profile_picture")

    if old_profile_pic:
        # Handle old paths: /legacy-static/uploads/profile_pictures/xxx.jpg or /api/static/uploads/xxx.jpg
        old_path = None
        if "/legacy-static/" in old_profile_pic:
            # Old format: /legacy-static/uploads/profile_pictures/xxx.jpg
            filename = old_profile_pic.split("/")[-1]
            old_path = os.path.join(UPLOAD_DIR, filename)
        elif "/api/static/uploads/" in old_profile_pic:
            # New format: /api/static/uploads/xxx.jpg
            filename = old_profile_pic.replace("/api/static/uploads/", "")
            old_path = os.path.join(UPLOAD_DIR, filename)
        
        if old_path and os.path.exists(old_path):
            try:
                os.remove(old_path)
                print(f"🗑️ Deleted old profile picture: {old_path}")
            except Exception as e:
                print(f"⚠️ Failed to delete old profile picture: {e}")

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
        # Handle old paths: /legacy-static/uploads/profile_pictures/xxx.jpg or /api/static/uploads/xxx.jpg
        old_path = None
        if "/legacy-static/" in old_profile_pic:
            # Old format: /legacy-static/uploads/profile_pictures/xxx.jpg
            filename = old_profile_pic.split("/")[-1]
            old_path = os.path.join(UPLOAD_DIR, filename)
        elif "/api/static/uploads/" in old_profile_pic:
            # New format: /api/static/uploads/xxx.jpg
            filename = old_profile_pic.replace("/api/static/uploads/", "")
            old_path = os.path.join(UPLOAD_DIR, filename)
        
        if old_path and os.path.exists(old_path):
            try:
                os.remove(old_path)
                print(f"🗑️ Deleted profile picture file: {old_path}")
            except Exception as e:
                print(f"⚠️ Failed to delete profile picture: {e}")

    # Remove from DB
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile_picture": None}}
    )

    return {
        "message": "Profile picture removed successfully",
        "profile_image_url": None
    }
