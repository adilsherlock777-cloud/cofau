from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from routers.notifications import create_notification

router = APIRouter(prefix="/api/compliments", tags=["compliments"])


class ComplimentRequest(BaseModel):
    compliment_type: str  # "thank_you", "youre_cool", "hot_stuff", "youre_funny", "write_more"
    recipient_id: str


# Compliment types with their display names and icons
COMPLIMENT_TYPES = {
    "thank_you": {
        "name": "Thank You",
        "icon": "🙏",
        "color": "#FFA500"
    },
    "youre_cool": {
        "name": "You're Cool",
        "icon": "❄️",
        "color": "#4FC3F7"
    },
    "hot_stuff": {
        "name": "Hot Stuff",
        "icon": "🔥",
        "color": "#FF5252"
    },
    "youre_funny": {
        "name": "You're Funny",
        "icon": "😄",
        "color": "#66BB6A"
    },
    "write_more": {
        "name": "Write More",
        "icon": "📖",
        "color": "#8D6E63"
    }
}


@router.post("/send")
async def send_compliment(
    request: ComplimentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a compliment to another user"""
    db = get_database()
    
    # Validate compliment type
    if request.compliment_type not in COMPLIMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid compliment type")
    
    # Check if trying to compliment yourself
    if request.recipient_id == str(current_user["_id"]):
        raise HTTPException(status_code=400, detail="Cannot send compliment to yourself")
    
    # Verify recipient exists
    recipient = await db.users.find_one({"_id": ObjectId(request.recipient_id)})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Check if already sent this compliment type today (optional - prevent spam)
    # For now, we'll allow multiple compliments
    
    # Store compliment in database
    compliment_doc = {
        "from_user_id": str(current_user["_id"]),
        "to_user_id": request.recipient_id,
        "compliment_type": request.compliment_type,
        "created_at": datetime.utcnow()
    }
    
    result = await db.compliments.insert_one(compliment_doc)
    compliment_id = str(result.inserted_id)
    
    # Get compliment details
    compliment_info = COMPLIMENT_TYPES[request.compliment_type]
    
    # Create notification
    notification_message = f"{current_user['full_name']} sent you a {compliment_info['name']} compliment"
    
    await create_notification(
        db=db,
        notification_type="compliment",
        from_user_id=str(current_user["_id"]),
        to_user_id=request.recipient_id,
        message=notification_message,
        send_push=True
    )
    
    return {
        "message": "Compliment sent successfully",
        "compliment_id": compliment_id,
        "compliment_type": request.compliment_type,
        "compliment_name": compliment_info["name"]
    }


@router.get("/types")
async def get_compliment_types():
    """Get all available compliment types"""
    return {
        "compliment_types": [
            {
                "type": key,
                "name": value["name"],
                "icon": value["icon"],
                "color": value["color"]
            }
            for key, value in COMPLIMENT_TYPES.items()
        ]
    }


@router.get("/received")
async def get_received_compliments(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get compliments received by the current user"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    # Fetch compliments
    cursor = db.compliments.find(
        {"to_user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    compliments = await cursor.to_list(length=limit)
    
    # Enrich with user details
    result = []
    for compliment in compliments:
        from_user = await db.users.find_one({"_id": ObjectId(compliment["from_user_id"])})
        compliment_type = compliment["compliment_type"]
        compliment_info = COMPLIMENT_TYPES.get(compliment_type, {})
        
        result.append({
            "id": str(compliment["_id"]),
            "from_user_id": compliment["from_user_id"],
            "from_user_name": from_user["full_name"] if from_user else "Unknown User",
            "from_user_profile_picture": from_user.get("profile_picture") if from_user else None,
            "compliment_type": compliment_type,
            "compliment_name": compliment_info.get("name", compliment_type),
            "compliment_icon": compliment_info.get("icon", "💝"),
            "compliment_color": compliment_info.get("color", "#999"),
            "created_at": compliment["created_at"]
        })
    
    return result


@router.get("/sent")
async def get_sent_compliments(
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get compliments sent by the current user"""
    db = get_database()
    user_id = str(current_user["_id"])
    
    # Fetch compliments
    cursor = db.compliments.find(
        {"from_user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    compliments = await cursor.to_list(length=limit)
    
    # Enrich with recipient details
    result = []
    for compliment in compliments:
        to_user = await db.users.find_one({"_id": ObjectId(compliment["to_user_id"])})
        compliment_type = compliment["compliment_type"]
        compliment_info = COMPLIMENT_TYPES.get(compliment_type, {})
        
        result.append({
            "id": str(compliment["_id"]),
            "to_user_id": compliment["to_user_id"],
            "to_user_name": to_user["full_name"] if to_user else "Unknown User",
            "to_user_profile_picture": to_user.get("profile_picture") if to_user else None,
            "compliment_type": compliment_type,
            "compliment_name": compliment_info.get("name", compliment_type),
            "compliment_icon": compliment_info.get("icon", "💝"),
            "compliment_color": compliment_info.get("color", "#999"),
            "created_at": compliment["created_at"]
        })
    
    return result


@router.get("/user/{user_id}/count")
async def get_user_compliments_count(user_id: str):
    """Get total compliments count received by a user"""
    db = get_database()
    
    # Count compliments received by this user
    count = await db.compliments.count_documents({"to_user_id": user_id})
    
    return {"compliments_count": count}


@router.get("/user/{user_id}/received")
async def get_user_received_compliments(
    user_id: str,
    limit: int = 50,
    skip: int = 0
):
    """Get compliments received by a specific user"""
    db = get_database()
    
    # Fetch compliments
    cursor = db.compliments.find(
        {"to_user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    compliments = await cursor.to_list(length=limit)
    
    # Enrich with user details
    result = []
    for compliment in compliments:
        from_user = await db.users.find_one({"_id": ObjectId(compliment["from_user_id"])})
        compliment_type = compliment["compliment_type"]
        compliment_info = COMPLIMENT_TYPES.get(compliment_type, {})
        
        result.append({
            "id": str(compliment["_id"]),
            "from_user_id": compliment["from_user_id"],
            "from_user_name": from_user["full_name"] if from_user else "Unknown User",
            "from_user_profile_picture": from_user.get("profile_picture") if from_user else None,
            "compliment_type": compliment_type,
            "compliment_name": compliment_info.get("name", compliment_type),
            "compliment_icon": compliment_info.get("icon", "💝"),
            "compliment_color": compliment_info.get("color", "#999"),
            "created_at": compliment["created_at"].isoformat() if hasattr(compliment["created_at"], "isoformat") else str(compliment["created_at"])
        })
    
    return result

