from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, status, Depends
from typing import Dict, Set, List, Any
from bson import ObjectId
from datetime import datetime
from database import get_database
from utils.jwt import decode_access_token  # adjust if named differently
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

def get_user_id_from_token(token: str) -> str:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    payload = decode_access_token(token)
    user_id = (
        payload.get("user_id")
        or payload.get("sub")
        or payload.get("id")
    )
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return str(user_id)

@router.websocket("/ws/{other_user_id}")
async def chat_ws(websocket: WebSocket, other_user_id: str):
    token = websocket.query_params.get("token")
    try:
        current_user_id = get_user_id_from_token(token)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(current_user_id, websocket)
    db = get_database()

    try:
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
            await manager.send_personal_message(current_user_id, msg_payload)
            await manager.send_personal_message(other_user_id, msg_payload)

    except WebSocketDisconnect:
        manager.disconnect(current_user_id, websocket)
    except Exception:
        manager.disconnect(current_user_id, websocket)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

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
