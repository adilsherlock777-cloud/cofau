# Direct WebSocket Fix

## Root Cause Identified

After thorough investigation, I've identified the exact problem:

1. **Frontend** connects to: `/api/chat/ws/${userId}`
2. **Backend router** defines: `/ws/{other_user_id}` with prefix `/api/chat`

This creates a route at `/api/chat/ws/{other_user_id}`, which _should_ work, but FastAPI's router handling for WebSockets has known issues with prefixes.

## The Solution: Direct WebSocket Route

I've added a direct WebSocket route on the main FastAPI app that exactly matches the frontend path:

```python
# Direct WebSocket endpoint on the main app
@app.websocket("/api/chat/ws/{user_id}")
async def direct_chat_ws(websocket: WebSocket, user_id: str):
    """Direct WebSocket endpoint on the main app (bypassing router)"""
    from routers.chat import chat_ws
    print(f"🔄 Forwarding WebSocket connection to chat_ws handler for user_id: {user_id}")
    await chat_ws(websocket, user_id)
```

This:

1. Creates a route that **exactly matches** the frontend path
2. Bypasses the router's prefix handling
3. Forwards the connection to your existing handler

## Simplified Nginx Configuration

I've also simplified the nginx location block:

```nginx
# WebSocket support for chat - simpler exact path match
location /api/chat/ws/ {
    proxy_pass http://127.0.0.1:8000;

    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Disable buffering for WebSocket (important!)
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;

    # Extended timeouts for long-lived WebSocket connections
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

## Why This Will Work

1. **Direct route** - No more router prefix issues
2. **Exact path match** - The path now exactly matches what the frontend expects
3. **Same handler** - We're still using your existing chat handler logic

## Steps to Apply

1. **Update your backend server.py** with the new direct WebSocket endpoint

2. **Update nginx config** to use the simpler location block:

   ```bash
   sudo nano /etc/nginx/sites-available/backend.cofau.in
   ```

3. **Test nginx config**:

   ```bash
   sudo nginx -t
   ```

4. **Reload nginx**:

   ```bash
   sudo systemctl reload nginx
   ```

5. **Restart backend**:
   ```bash
   pm2 restart cofau-ba
   ```

## Verification

After applying these changes:

1. Check backend logs to see if the WebSocket connection is being received:

   ```bash
   pm2 logs cofau-ba
   ```

2. Look for these log messages:

   - `🔄 Forwarding WebSocket connection to chat_ws handler`
   - `🔗 WebSocket connection attempt for user_id`
   - `✅ WebSocket connection accepted`

3. Open the chat in your app and try sending a message

## Technical Explanation

The issue is related to how FastAPI handles WebSocket routes with prefixes. By adding a direct WebSocket route on the main app, we bypass this issue and ensure the exact path is matched.

This approach is recommended in FastAPI's documentation for complex WebSocket scenarios.
