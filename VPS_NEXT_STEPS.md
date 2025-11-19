# VPS Deployment - Next Steps After Uploading Code

Simple step-by-step guide for what to do after uploading your code to VPS.

## 🚀 Quick Deployment (Recommended)

### Option 1: Use the Deployment Script (Easiest)

```bash
# 1. Upload your code to VPS (via git, scp, or FTP)
cd /opt/cofau-backend  # or wherever you uploaded the code

# 2. Make the script executable
chmod +x deploy.sh

# 3. Run the deployment script
./deploy.sh
```

The script will:

- ✅ Setup Python virtual environment
- ✅ Install all dependencies
- ✅ Create .env file template
- ✅ Create required directories
- ✅ Setup systemd service
- ✅ Start the backend server

---

## 📝 Manual Steps (If you prefer step-by-step)

### Step 1: Navigate to Backend Directory

```bash
cd /opt/cofau-backend/backend  # or your path
```

### Step 2: Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Create .env File

```bash
nano .env
```

Add this content (update values as needed):

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=cofau_db
SECRET_KEY=your-very-secure-secret-key-min-32-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

Save and exit (Ctrl+X, then Y, then Enter)

```bash
chmod 600 .env
```

### Step 4: Create Required Directories

```bash
mkdir -p static/uploads static/uploads/profile_pictures static/stories
chmod -R 755 static
```

### Step 5: Test Server (Optional)

```bash
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# Press Ctrl+C to stop
```

### Step 6: Create systemd Service

```bash
sudo nano /etc/systemd/system/cofau-backend.service
```

Paste this (update paths to match your installation):

```ini
[Unit]
Description=Cofau Backend API Server
After=network.target mongod.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/cofau-backend/backend
Environment="PATH=/opt/cofau-backend/backend/venv/bin"
ExecStart=/opt/cofau-backend/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Important:** Replace:

- `YOUR_USERNAME` with your actual username
- `/opt/cofau-backend/backend` with your actual path

### Step 7: Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable cofau-backend
sudo systemctl start cofau-backend
sudo systemctl status cofau-backend
```

---

## ✅ Verify It's Working

```bash
# Check service status
sudo systemctl status cofau-backend

# Test API endpoint
curl http://localhost:8000/api

# Should return: {"message":"Cofau API is running","version":"1.0.0"}
```

---

## 🔧 Common Commands

```bash
# View logs
sudo journalctl -u cofau-backend -f

# Restart server
sudo systemctl restart cofau-backend

# Stop server
sudo systemctl stop cofau-backend

# Check if running
sudo systemctl status cofau-backend
```

---

## 🌐 Setup Nginx (To access from outside)

### Install Nginx

```bash
sudo apt install -y nginx
```

### Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/cofau-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_IP_OR_DOMAIN;
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

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/cofau-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔥 Setup Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 🐛 Troubleshooting

### Server won't start

```bash
# Check logs
sudo journalctl -u cofau-backend -n 50

# Common issues:
# - MongoDB not running: sudo systemctl start mongod
# - Wrong paths in service file: Check WorkingDirectory and ExecStart
# - Permission issues: Check file ownership
```

### Can't connect to API

```bash
# Check if server is running
sudo systemctl status cofau-backend

# Check if port is open
sudo netstat -tulpn | grep 8000

# Test locally
curl http://localhost:8000/api
```

### MongoDB issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

---

## 📋 Complete Checklist

After uploading code, make sure:

- [ ] Python 3.11+ installed
- [ ] MongoDB installed and running
- [ ] Virtual environment created
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] `.env` file created with correct values
- [ ] Static directories created
- [ ] systemd service created and enabled
- [ ] Server started and running
- [ ] API responding at `http://localhost:8000/api`
- [ ] Nginx configured (optional)
- [ ] Firewall configured

---

## 🎯 Quick Reference

**After uploading code, run:**

```bash
cd /opt/cofau-backend  # or your path
chmod +x deploy.sh
./deploy.sh
```

**Or manually:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Create .env file
# Setup systemd service
# Start service
```

---

**Your backend will be running at: `http://YOUR_VPS_IP:8000/api`**
