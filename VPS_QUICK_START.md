# VPS Quick Start Checklist

Quick reference for deploying Cofau backend on VPS.

## 🚀 Quick Commands

### 1. Initial Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git build-essential python3-dev
```

### 2. Install MongoDB

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod
```

### 3. Clone & Setup

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> cofau-backend
sudo chown -R $USER:$USER cofau-backend
cd cofau-backend/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
nano .env
# Add: MONGO_URL=mongodb://localhost:27017
# Add: SECRET_KEY=your-secret-key-here
chmod 600 .env
```

### 5. Create Directories

```bash
mkdir -p static/uploads static/uploads/profile_pictures static/stories
chmod -R 755 static
```

### 6. Test Server

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# Press Ctrl+C after testing
```

### 7. Create systemd Service

```bash
sudo nano /etc/systemd/system/cofau-backend.service
```

Paste this (update paths!):

```ini
[Unit]
Description=Cofau Backend API Server
After=network.target mongod.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/cofau-backend/backend
Environment="PATH=/opt/cofau-backend/backend/venv/bin"
ExecStart=/opt/cofau-backend/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cofau-backend
sudo systemctl start cofau-backend
sudo systemctl status cofau-backend
```

### 8. Setup Nginx

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/cofau-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/static/ {
        alias /opt/cofau-backend/backend/static/;
    }
}
```

Then:

```bash
sudo ln -s /etc/nginx/sites-available/cofau-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Setup Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 10. SSL (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📋 Essential Commands

```bash
# Server management
sudo systemctl start cofau-backend
sudo systemctl stop cofau-backend
sudo systemctl restart cofau-backend
sudo systemctl status cofau-backend
sudo journalctl -u cofau-backend -f

# Update code
cd /opt/cofau-backend
git pull
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart cofau-backend

# MongoDB
sudo systemctl status mongod
mongosh

# Nginx
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ Verification

```bash
# Check server
curl http://localhost:8000/api

# Check via Nginx
curl http://YOUR_IP/api

# Check services
sudo systemctl status cofau-backend
sudo systemctl status mongod
sudo systemctl status nginx
```

---

**Full detailed guide: See `VPS_DEPLOYMENT_GUIDE.md`**
