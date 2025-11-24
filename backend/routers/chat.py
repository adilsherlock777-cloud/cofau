from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, Depends
from typing import Dict, Set, List, Any
from bson import ObjectId
from datetime import datetime
from database import get_database
from utils.jwt import decode_access_token
from routers.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(user_id, set()).add(websocket)

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
    token = websocket.query_params.get("token")
    
    try:
        current_user_id = await get_user_id_from_token(token)
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
                }
                for m in history
            ],
        })

        # receive and broadcast new messages
        while True:
            try:
                data = await websocket.receive_json()
                text = (data.get("message") or "").strip()
                if not text:
                    continue

                now = datetime.utcnow()
                msg_doc = {
                    "from_user": current_user_id,
                    "to_user": other_user_id,
                    "message": text,
                    "created_at": now,
                }
                result = await db.messages.insert_one(msg_doc)
                msg_id = str(result.inserted_id)
                msg_payload = {
                    "type": "message",
                    "id": msg_id,
                    "from_user": current_user_id,
                    "to_user": other_user_id,
                    "message": text,
                    "created_at": now.isoformat() + "Z",
                }
                
                # Send to both users
                await manager.send_personal_message(current_user_id, msg_payload)
                await manager.send_personal_message(other_user_id, msg_payload)
                print(f"📨 Message sent: {current_user_id} -> {other_user_id}")
                
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
