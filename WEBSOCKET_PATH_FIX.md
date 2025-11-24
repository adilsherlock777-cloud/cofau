# WebSocket Path Fix

## Found the issue!

The problem is that there's a **path mismatch** between your frontend and backend:

1. **Frontend** is connecting to:

   ```
   /api/chat/ws/${userId}
   ```

2. **Backend** route is defined as:
   ```
   /ws/{other_user_id}
   ```
   (inside the router with prefix `/api/chat`)

## Solution: Update Nginx Configuration

The nginx location block needs to match the exact path pattern with the user ID:

```nginx
# WebSocket support for chat - match exact path pattern
location ~ ^/api/chat/ws/[^/]+$ {
    proxy_pass http://127.0.0.1:8000;

    proxy_http_version 1.1;

    # WebSocket upgrade headers (critical for WebSocket)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Disable buffering for WebSocket (important!)
    proxy_buffering off;
    proxy_cache off;
    proxy_request_buffering off;

    # Extended timeouts for long-lived WebSocket connections (7 days)
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

## What Changed?

Changed from:

```nginx
location /api/chat/ws/ {
```

To:

```nginx
location ~ ^/api/chat/ws/[^/]+$ {
```

This uses a regular expression to match:

- `^/api/chat/ws/` - Starts with this exact path
- `[^/]+` - Followed by one or more characters that are not a forward slash (the user ID)
- `$` - End of the path

## Steps to Apply

1. **Update the nginx config**:

   ```bash
   sudo nano /etc/nginx/sites-available/backend.cofau.in
   ```

2. **Test the config**:

   ```bash
   sudo nginx -t
   ```

3. **Reload nginx**:

   ```bash
   sudo systemctl reload nginx
   ```

4. **Restart the backend**:
   ```bash
   pm2 restart cofau-ba
   ```

## Test Endpoint

I've also added a test WebSocket endpoint directly on the FastAPI app to verify WebSocket functionality:

```python
@app.websocket("/test-ws")
async def test_websocket(websocket: WebSocket):
    """Test WebSocket endpoint directly on the app (bypassing routers)"""
    try:
        print("⚡ Test WebSocket connection attempt")
        await websocket.accept()
        print("⚡ Test WebSocket accepted")
        await websocket.send_text("Hello from WebSocket test endpoint!")
        await websocket.close()
    except Exception as e:
        print(f"⚡ Test WebSocket error: {str(e)}")
        try:
            await websocket.close()
        except:
            pass
```

You can test this endpoint with:

```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" https://backend.cofau.com/test-ws
```

## Verification

After applying these changes:

1. Restart your backend server
2. Open the chat app
3. Check the console logs - you should see successful WebSocket connection
4. Try sending a message - it should work now

If still having issues, check the backend logs for any errors:

```bash
pm2 logs cofau-ba
```
