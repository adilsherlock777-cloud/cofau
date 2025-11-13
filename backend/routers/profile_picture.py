from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from datetime import datetime
from bson import ObjectId
import os
import shutil
from database import get_database
from routers.auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["profile_picture"])

# Directory for storing profile pictures
UPLOAD_DIR = "backend/static/uploads/profile_pictures"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload or update user's profile picture"""
    db = get_database()
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    user_id = str(current_user["_id"])
    filename = f"profile_{user_id}_{timestamp}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Delete old profile picture if exists
    old_profile_pic = current_user.get("profile_picture")
    if old_profile_pic and old_profile_pic.startswith('/api/static/uploads/profile_pictures/'):
        old_file_path = old_profile_pic.replace('/api/static/uploads/', 'backend/static/uploads/')
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
                print(f"🗑️ Deleted old profile picture: {old_file_path}")
            except Exception as e:
                print(f"⚠️ Could not delete old profile picture: {e}")
    
    # Save new file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"✅ Saved profile picture: {file_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Generate public URL
    profile_image_url = f"/api/static/uploads/profile_pictures/{filename}"
    
    # Update user in database
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
    """Remove user's profile picture and reset to default"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    # Get current profile picture
    old_profile_pic = current_user.get("profile_picture")
    
    # Delete file if exists
    if old_profile_pic and old_profile_pic.startswith('/api/static/uploads/profile_pictures/'):
        old_file_path = old_profile_pic.replace('/api/static/uploads/', 'backend/static/uploads/')
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
                print(f"🗑️ Deleted profile picture: {old_file_path}")
            except Exception as e:
                print(f"⚠️ Could not delete profile picture: {e}")
    
    # Update user in database - set to None
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"profile_picture": None}}
    )
    
    print(f"📸 Removed profile picture for user {user_id}")
    
    return {
        "message": "Profile picture removed successfully",
        "profile_image_url": None
    }
