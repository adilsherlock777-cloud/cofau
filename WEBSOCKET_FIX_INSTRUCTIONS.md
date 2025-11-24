# WebSocket Chat Fix Instructions

## Problem

- WebSocket connection stuck in CONNECTING state (never opens)
- Messages cannot be sent
- Messages are not being stored

## Root Cause

The nginx reverse proxy is not configured to handle WebSocket upgrade requests. WebSocket connections require special HTTP headers (`Upgrade` and `Connection`) that nginx must forward to the backend.

## Solution

### Step 1: Update Nginx Configuration

**IMPORTANT:** You must update your nginx configuration on the server to support WebSocket connections.

1. SSH into your server:

   ```bash
   ssh root@srv1065749
   ```

2. Backup your current nginx config:

   ```bash
   sudo cp /etc/nginx/sites-available/backend.cofau.in /etc/nginx/sites-available/backend.cofau.in.backup
   ```

3. Edit the nginx configuration:

   ```bash
   sudo nano /etc/nginx/sites-available/backend.cofau.in
   ```

4. Replace the content with the updated configuration (see `backend_nginx_config.conf` file)

   **Key addition:** A new `location /api/chat/ws/` block with WebSocket support:

   ```nginx
   location /api/chat/ws/ {
       proxy_pass http://127.0.0.1:8000;

       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;

       proxy_connect_timeout 300;
       proxy_send_timeout 300;
       proxy_read_timeout 300;
   }
   ```

5. Test the nginx configuration:

   ```bash
   sudo nginx -t
   ```

6. If test passes, reload nginx:
   ```bash
   sudo systemctl reload nginx
   ```

### Step 2: Restart Backend Server

Restart your FastAPI backend to ensure all code changes are loaded:

```bash
# If using PM2
pm2 restart cofau-ba

# Or if using systemd
sudo systemctl restart your-backend-service
```

### Step 3: Verify the Fix

1. Check backend logs for WebSocket connection messages:

   ```bash
   pm2 logs cofau-ba
   ```

2. You should see messages like:

   - `🔗 WebSocket connection attempt for user_id: ...`
   - `✅ WebSocket connection accepted`
   - `✅ Authenticated user: ...`
   - `✅ WebSocket connected: user ... -> ...`

3. Test in the app:
   - Open a chat
   - The WebSocket should connect (check console logs)
   - Try sending a message
   - Message should be stored and displayed

## Code Changes Made

### Backend (`backend/routers/chat.py`)

- ✅ Fixed JWT token decoding
- ✅ Fixed user ID lookup from email
- ✅ Added WebSocket connection acceptance before authentication
- ✅ Improved error handling and logging
- ✅ Added connection tracking

### Frontend (`frontend/app/chat/[userId].tsx`)

- ✅ Added connection state waiting logic
- ✅ Improved error messages
- ✅ Better WebSocket state handling
- ✅ Fixed TypeScript types

## Testing

After applying the nginx configuration:

1. **Test endpoint** (should work): https://backend.cofau.com/api/chat/test

   - Expected: `{"message":"Chat router is working","status":"ok"}`

2. **WebSocket connection** (should now work):
   - Open chat in app
   - Check console for: `🟢 WebSocket Connected`
   - Try sending a message
   - Message should appear in chat

## Troubleshooting

If WebSocket still doesn't work after nginx update:

1. **Check nginx error logs:**

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Check backend logs:**

   ```bash
   pm2 logs cofau-ba
   ```

3. **Verify nginx configuration is active:**

   ```bash
   sudo nginx -T | grep -A 20 "location /api/chat/ws"
   ```

4. **Test WebSocket connection directly:**
   ```bash
   # This should show WebSocket upgrade headers
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: test" \
        https://backend.cofau.com/api/chat/ws/test?token=YOUR_TOKEN
   ```

## Important Notes

- ⚠️ **The nginx configuration MUST be updated** - this is the critical fix
- ⚠️ **Nginx must be reloaded** after configuration changes
- ⚠️ **Backend must be restarted** to load code changes
- The WebSocket location block must come **before** the general `/` location block in nginx config
