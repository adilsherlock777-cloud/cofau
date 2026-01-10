from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Set, List, Any, Optional
from bson import ObjectId
from datetime import datetime
from database import get_database
from utils.jwt import decode_access_token
from routers.auth import get_current_user
from routers.notifications import create_notification

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Test endpoint to verify router is working
@router.get("/test")
async def test_chat_router():
    return {"message": "Chat router is working", "status": "ok"}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        # Note: websocket.accept() is called before this, so we just add to connections
        self.active_connections.setdefault(user_id, set()).add(websocket)
        print(f"📝 Added connection for user {user_id}, total connections: {len(self.active_connections.get(user_id, set()))}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        conns = self.active_connections.get(user_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self.active_connections[user_id]

    async def send_personal_message(self, user_id: str, message: dict):
        for ws in list(self.active_connections.get(user_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(user_id, ws)

manager = ConnectionManager()

async def get_user_id_from_token(token: str) -> str:
    """Get user_id from JWT token by decoding and looking up user in database"""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: no email in payload")
        
        # Look up user by email to get user_id
        db = get_database()
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        return str(user["_id"])
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token validation failed: {str(e)}")

@router.websocket("/ws/{other_user_id}")
async def chat_ws(websocket: WebSocket, other_user_id: str):
    print(f"🔗 WebSocket connection attempt for user_id: {other_user_id}")
    
    # Accept connection first (required for WebSocket)
    try:
        await websocket.accept()
        print(f"✅ WebSocket connection accepted")
    except Exception as e:
        print(f"❌ Failed to accept WebSocket: {str(e)}")
        return
    
    token = websocket.query_params.get("token")
    if not token:
        print(f"❌ No token provided")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return
    
    try:
        current_user_id = await get_user_id_from_token(token)
        print(f"✅ Authenticated user: {current_user_id}")
    except HTTPException as e:
        print(f"❌ WebSocket auth error: {e.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=e.detail)
        return
    except Exception as e:
        print(f"❌ WebSocket error: {str(e)}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason="Internal server error")
        return

    try:
        await manager.connect(current_user_id, websocket)
        print(f"✅ WebSocket connected: user {current_user_id} -> {other_user_id}")
        
        db = get_database()

        # send last 50 messages (history)
        cursor = db.messages.find({
            "$or": [
                {"from_user": current_user_id, "to_user": other_user_id},
                {"from_user": other_user_id, "to_user": current_user_id},
            ]
        }).sort("created_at", -1).limit(50)
        history = await cursor.to_list(50)
        history.reverse()
        
        await websocket.send_json({
    "type": "history",
    "messages": [
        {
            "id": str(m["_id"]),
            "from_user": m["from_user"],
            "to_user": m["to_user"],
            "message": m["message"],
            "created_at": m["created_at"].isoformat() + "Z",
            "post_id": str(m.get("post_id")) if m.get("post_id") else None,
            "story_id": str(m.get("story_id")) if m.get("story_id") else None,
            "story_data": m.get("story_data"),
        }
        for m in history
    ],
})

        # receive and broadcast new messages
        while True:
            try:
                data = await websocket.receive_json()
                text = (data.get("message") or "").strip()
                post_id = data.get("post_id")  # Support post sharing via WebSocket
                story_id = data.get("story_id")  # Support story replies via WebSocket
                story_data = data.get("story_data")  # Story preview data
                
                # Allow empty message if post_id is provided (for post sharing)
                if not text and not post_id:
                    continue

                now = datetime.utcnow()
                msg_doc = {
    "from_user": current_user_id,
    "to_user": other_user_id,
    "message": text or (f"📷 Shared a post" if post_id else (f"📷 Replied to story" if story_id else "")),
    "created_at": now,
}

# Add post_id if provided
if post_id:
    msg_doc["post_id"] = post_id

# Add story_id and story_data if provided (story reply)
if story_id:
    msg_doc["story_id"] = story_id
if story_data:
    msg_doc["story_data"] = story_data
                
                result = await db.messages.insert_one(msg_doc)
                msg_id = str(result.inserted_id)
                msg_payload = {
    "type": "message",
    "id": msg_id,
    "from_user": current_user_id,
    "to_user": other_user_id,
    "message": msg_doc["message"],
    "created_at": now.isoformat() + "Z",
}

# Include post_id in payload if present
if post_id:
    msg_payload["post_id"] = post_id

# Include story data in payload if present
if story_id:
    msg_payload["story_id"] = story_id
if story_data:
    msg_payload["story_data"] = story_data
                
                # Send to both users
                await manager.send_personal_message(current_user_id, msg_payload)
                await manager.send_personal_message(other_user_id, msg_payload)
                print(f"📨 Message sent: {current_user_id} -> {other_user_id}")
                
                # Create notification and send push notification for the recipient
                try:
                    await create_notification(
                        db=db,
                        notification_type="message",
                        from_user_id=current_user_id,
                        to_user_id=other_user_id,
                        post_id=None,
                        message=None,  # Will use default message
                        send_push=True
                    )
                except Exception as e:
                    print(f"⚠️ Error creating message notification: {str(e)}")
                
            except WebSocketDisconnect:
                raise
            except Exception as e:
                print(f"❌ Error processing message: {str(e)}")
                # Continue listening for more messages
                continue

    except WebSocketDisconnect:
        print(f"🔌 WebSocket disconnected: {current_user_id}")
        manager.disconnect(current_user_id, websocket)
    except Exception as e:
        print(f"❌ WebSocket error: {str(e)}")
        manager.disconnect(current_user_id, websocket)
        try:
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR, reason=str(e))
        except:
            pass

@router.get("/conversation/{other_user_id}")
async def get_conversation(other_user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    current_user_id = str(current_user["_id"])
    msgs = await db.messages.find({
        "$or": [
            {"from_user": current_user_id, "to_user": other_user_id},
            {"from_user": other_user_id, "to_user": current_user_id},
        ]
    }).sort("created_at", 1).to_list(None)

    return [
    {
        "id": str(m["_id"]),
        "from_user": m["from_user"],
        "to_user": m["to_user"],
        "message": m["message"],
        "post_id": str(m.get("post_id")) if m.get("post_id") else None,
        "story_id": str(m.get("story_id")) if m.get("story_id") else None,
        "story_data": m.get("story_data"),
        "created_at": m["created_at"].isoformat() + "Z",
    }
    for m in msgs
]

@router.get("/list")
async def get_chat_list(current_user: dict = Depends(get_current_user)):
    db = get_database()
    current_user_id = str(current_user["_id"])
    msgs = await db.messages.find({
        "$or": [
            {"from_user": current_user_id},
            {"to_user": current_user_id},
        ]
    }).sort("created_at", -1).to_list(None)

    last_by_other: Dict[str, Any] = {}
    for m in msgs:
        other_id = m["to_user"] if m["from_user"] == current_user_id else m["from_user"]
        if other_id not in last_by_other:
            last_by_other[other_id] = m

    chat_list = []
    for other_id, m in last_by_other.items():
        user = await db.users.find_one({"_id": ObjectId(other_id)})
        chat_list.append({
            "other_user_id": other_id,
            "other_user_name": user["full_name"] if user else "Unknown",
            "other_user_profile_picture": user.get("profile_picture") if user else None,
            "last_message": m["message"],
            "last_from_me": m["from_user"] == current_user_id,
            "created_at": m["created_at"].isoformat() + "Z",
        })

    chat_list.sort(key=lambda x: x["created_at"], reverse=True)
    return chat_list

class SharePostRequest(BaseModel):
    post_id: str
    user_ids: List[str]

@router.post("/share-post")
async def share_post_to_users(
    request: SharePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """Share a post to multiple users via chat"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Verify post exists
    post = await db.posts.find_one({"_id": ObjectId(request.post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Get post details for the message
    post_owner = await db.users.find_one({"_id": ObjectId(post["user_id"])})
    post_username = post_owner.get("username") if post_owner else "Unknown"
    
    # Create messages for each user
    now = datetime.utcnow()
    shared_count = 0
    
    for user_id in request.user_ids:
        # Skip if trying to share to self
        if user_id == current_user_id:
            continue
            
        # Verify target user exists
        target_user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            continue
        
        # Create message with post_id
        msg_doc = {
            "from_user": current_user_id,
            "to_user": user_id,
            "message": f"📷 {post_username} shared a post",
            "post_id": request.post_id,
            "created_at": now,
        }
        
        await db.messages.insert_one(msg_doc)
        
        # Send via WebSocket if user is online
        msg_payload = {
            "type": "message",
            "id": str(msg_doc.get("_id", "")),
            "from_user": current_user_id,
            "to_user": user_id,
            "message": msg_doc["message"],
            "post_id": request.post_id,
            "created_at": now.isoformat() + "Z",
        }
        
        await manager.send_personal_message(user_id, msg_payload)
        
        # Create notification
        try:
            await create_notification(
                db=db,
                notification_type="message",
                from_user_id=current_user_id,
                to_user_id=user_id,
                post_id=request.post_id,
                message=None,
                send_push=True
            )
        except Exception as e:
            print(f"⚠️ Error creating notification: {str(e)}")
        
        shared_count += 1
    
    return {
        "message": f"Post shared to {shared_count} user(s)",
        "shared_count": shared_count
    }
@router.delete("/clear/{other_user_id}")
async def clear_chat(other_user_id: str, current_user: dict = Depends(get_current_user)):
    """Clear all messages between current user and other user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Delete all messages between the two users
    result = await db.messages.delete_many({
        "$or": [
            {"from_user": current_user_id, "to_user": other_user_id},
            {"from_user": other_user_id, "to_user": current_user_id},
        ]
    })
    
    return {
        "message": "Chat cleared successfully",
        "deleted_count": result.deleted_count
    }


# =============================================
# BLOCK USER ENDPOINTS
# =============================================
@router.post("/block/{user_id}")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Block a user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Check if user exists
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already blocked
    existing_block = await db.blocked_users.find_one({
        "blocker_id": current_user_id,
        "blocked_id": user_id
    })
    
    if existing_block:
        raise HTTPException(status_code=400, detail="User is already blocked")
    
    # Add to blocked_users collection
    await db.blocked_users.insert_one({
        "blocker_id": current_user_id,
        "blocked_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "User blocked successfully"}


@router.delete("/unblock/{user_id}")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unblock a user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    result = await db.blocked_users.delete_one({
        "blocker_id": current_user_id,
        "blocked_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User is not blocked")
    
    return {"message": "User unblocked successfully"}


@router.get("/is-blocked/{user_id}")
async def check_if_blocked(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check if a user is blocked (either direction)"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Check if current user blocked the other user
    i_blocked = await db.blocked_users.find_one({
        "blocker_id": current_user_id,
        "blocked_id": user_id
    })
    
    # Check if other user blocked current user
    they_blocked = await db.blocked_users.find_one({
        "blocker_id": user_id,
        "blocked_id": current_user_id
    })
    
    return {
        "i_blocked_them": i_blocked is not None,
        "they_blocked_me": they_blocked is not None,
        "is_blocked": i_blocked is not None or they_blocked is not None
    }


@router.get("/blocked")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """Get list of blocked users"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    blocked = await db.blocked_users.find({
        "blocker_id": current_user_id
    }).to_list(None)
    
    blocked_users = []
    for b in blocked:
        user = await db.users.find_one({"_id": ObjectId(b["blocked_id"])})
        if user:
            blocked_users.append({
                "user_id": b["blocked_id"],
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "profile_picture": user.get("profile_picture"),
                "blocked_at": b["created_at"].isoformat() + "Z"
            })
    
    return blocked_users


# =============================================
# MUTE USER ENDPOINTS
# =============================================
@router.post("/mute/{user_id}")
async def mute_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Mute notifications from a user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    # Check if user exists
    target_user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already muted
    existing_mute = await db.muted_users.find_one({
        "muter_id": current_user_id,
        "muted_id": user_id
    })
    
    if existing_mute:
        raise HTTPException(status_code=400, detail="User is already muted")
    
    # Add to muted_users collection
    await db.muted_users.insert_one({
        "muter_id": current_user_id,
        "muted_id": user_id,
        "created_at": datetime.utcnow()
    })
    
    return {"message": "User muted successfully"}


@router.delete("/unmute/{user_id}")
async def unmute_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unmute notifications from a user"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    result = await db.muted_users.delete_one({
        "muter_id": current_user_id,
        "muted_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User is not muted")
    
    return {"message": "User unmuted successfully"}


@router.get("/is-muted/{user_id}")
async def check_if_muted(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check if a user is muted"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    muted = await db.muted_users.find_one({
        "muter_id": current_user_id,
        "muted_id": user_id
    })
    
    return {
        "is_muted": muted is not None
    }


@router.get("/muted")
async def get_muted_users(current_user: dict = Depends(get_current_user)):
    """Get list of muted users"""
    db = get_database()
    current_user_id = str(current_user["_id"])
    
    muted = await db.muted_users.find({
        "muter_id": current_user_id
    }).to_list(None)
    
    muted_users = []
    for m in muted:
        user = await db.users.find_one({"_id": ObjectId(m["muted_id"])})
        if user:
            muted_users.append({
                "user_id": m["muted_id"],
                "username": user.get("username"),
                "full_name": user.get("full_name"),
                "profile_picture": user.get("profile_picture"),
                "muted_at": m["created_at"].isoformat() + "Z"
            })
    
    return muted_users