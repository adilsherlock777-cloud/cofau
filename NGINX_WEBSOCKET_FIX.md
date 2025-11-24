# Complete Nginx Configuration for WebSocket Chat

## Updated Configuration

Here's the **complete optimized nginx configuration** for your `backend.cofau.in` file:

```nginx
server {
    listen 80;
    server_name backend.cofau.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name backend.cofau.com;

    client_max_body_size 300M;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/backend.cofau.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/backend.cofau.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # WebSocket support for chat
    location /api/chat/ws/ {
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

    location / {
        proxy_pass http://127.0.0.1:8000;   # your backend running in PM2

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_request_buffering off;
        proxy_buffering off;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
```

## Key Improvements Added

### 1. **Disabled Buffering** (Critical!)

```nginx
proxy_buffering off;
proxy_cache off;
proxy_request_buffering off;
```

- WebSocket connections are real-time and should not be buffered
- This ensures messages are sent immediately

### 2. **Extended Timeouts**

```nginx
proxy_connect_timeout 7d;
proxy_send_timeout 7d;
proxy_read_timeout 7d;
```

- Changed from 300 seconds to 7 days
- WebSocket connections can stay open for long periods
- Prevents premature disconnections

### 3. **Proper Upgrade Headers**

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

- These headers are **required** for WebSocket to work
- They tell nginx to upgrade the HTTP connection to WebSocket

## What Was Missing in Your Original Config

Your original config had the WebSocket location block, but it was missing:

1. ❌ **`proxy_buffering off`** - Without this, WebSocket messages might be buffered
2. ❌ **`proxy_cache off`** - Prevents caching of WebSocket connections
3. ❌ **Extended timeouts** - 300 seconds is too short for long-lived connections

## How to Apply

1. **Backup current config:**

   ```bash
   sudo cp /etc/nginx/sites-available/backend.cofau.in /etc/nginx/sites-available/backend.cofau.in.backup
   ```

2. **Edit the file:**

   ```bash
   sudo nano /etc/nginx/sites-available/backend.cofau.in
   ```

3. **Replace with the configuration above**

4. **Test configuration:**

   ```bash
   sudo nginx -t
   ```

5. **If test passes, reload nginx:**

   ```bash
   sudo systemctl reload nginx
   ```

6. **Restart backend:**
   ```bash
   pm2 restart cofau-ba
   ```

## Verification

After applying, test the WebSocket connection:

1. Open your chat app
2. Check browser console - should see: `🟢 WebSocket Connected`
3. Try sending a message - should work immediately
4. Check backend logs: `pm2 logs cofau-ba` - should see connection messages

## Troubleshooting

If still not working:

1. **Check nginx error logs:**

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Verify WebSocket location is active:**

   ```bash
   sudo nginx -T | grep -A 15 "location /api/chat/ws"
   ```

3. **Test WebSocket directly:**
   ```bash
   # Should return 101 Switching Protocols
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     https://backend.cofau.com/api/chat/ws/test?token=YOUR_TOKEN
   ```

## Important Notes

- ⚠️ The WebSocket location block **must come before** the general `/` location block
- ⚠️ `proxy_buffering off` is **critical** for real-time WebSocket communication
- ⚠️ Extended timeouts prevent connection drops during idle periods
- ⚠️ Always test nginx config before reloading: `sudo nginx -t`
