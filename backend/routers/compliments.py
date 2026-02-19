from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from routers.notifications import create_notification

router = APIRouter(prefix="/api/compliments", tags=["compliments"])


class ComplimentRequest(BaseModel):
    compliment_type: str
    recipient_id: str
    custom_message: str = None  # Add this line for custom messages


# Compliment types with their display names and icons
COMPLIMENT_TYPES = {
    "amazing_taste": {
        "name": "You've got amazing taste!",
        "icon": "✨",
        "color": "#FF6B6B"
    },
    "on_point": {
        "name": "Your food choices are always on point.",
        "icon": "🎯",
        "color": "#4ECDC4"
    },
    "never_miss": {
        "name": "Your recommendations never miss!",
        "icon": "🔥",
        "color": "#FF9F43"
    },
    "top_tier": {
        "name": "Top-tier food spotting!",
        "icon": "🏆",
        "color": "#F9CA24"
    },
    "knows_good_food": {
        "name": "You really know good food.",
        "icon": "👨‍🍳",
        "color": "#6C5CE7"
    },
    "custom": {
        "name": "Custom Message",
        "icon": "💬",
        "color": "#E91E63"
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
    
    # Store compliment in database
    compliment_doc = {
        "from_user_id": str(current_user["_id"]),
        "to_user_id": request.recipient_id,
        "compliment_type": request.compliment_type,
        "custom_message": request.custom_message if request.compliment_type == "custom" else None,
        "created_at": datetime.utcnow()
    }
    
    result = await db.compliments.insert_one(compliment_doc)
    compliment_id = str(result.inserted_id)
    
    # Get compliment details
    compliment_info = COMPLIMENT_TYPES[request.compliment_type]
    
    # Create notification message
    if request.compliment_type == "custom" and request.custom_message:
        notification_message = f"{current_user['full_name']} sent you a compliment: \"{request.custom_message[:50]}{'...' if len(request.custom_message) > 50 else ''}\""
    else:
        notification_message = f"{current_user['full_name']} says: {compliment_info['name']}"
    
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
    limit: int = 100,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get compliments received by the current user (latest 100 max)"""
    db = get_database()
    user_id = str(current_user["_id"])

    # Cap limit to 100
    limit = min(limit, 100)

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
            "from_user_username": from_user.get("username") if from_user else None,
            "from_user_profile_picture": from_user.get("profile_picture") if from_user else None,
            "compliment_type": compliment_type,
            "compliment_name": compliment_info.get("name", compliment_type),
            "compliment_icon": compliment_info.get("icon", "💝"),
            "compliment_color": compliment_info.get("color", "#999"),
            "custom_message": compliment.get("custom_message"),
            "created_at": compliment["created_at"].isoformat() if hasattr(compliment["created_at"], "isoformat") else str(compliment["created_at"])
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


@router.get("/check/{user_id}")
async def check_if_complimented(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if the current user has already complimented the specified user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Check if a compliment exists from current user to target user
    compliment = await db.compliments.find_one({
        "from_user_id": current_user_id,
        "to_user_id": user_id
    })
    
    return {
        "has_complimented": compliment is not None,
        "compliment_id": str(compliment["_id"]) if compliment else None
    }


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

