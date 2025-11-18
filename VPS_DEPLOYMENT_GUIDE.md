# VPS Deployment Guide - Cofau Backend Server

Complete step-by-step guide to deploy the Cofau backend server on a VPS.

## 📋 Prerequisites

- VPS with Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Domain name (optional, for SSL)
- Git repository access

---

## 🚀 Step 1: Initial VPS Setup

### 1.1 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Create Non-Root User (if needed)

```bash
sudo adduser cofau
sudo usermod -aG sudo cofau
su - cofau
```

---

## 🐍 Step 2: Install Python and Dependencies

### 2.1 Install Python 3.11+ and pip

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version  # Should be 3.11 or higher
```

### 2.2 Install Build Essentials (for some Python packages)

```bash
sudo apt install -y build-essential python3-dev
```

---

## 🍃 Step 3: Install and Configure MongoDB

### 3.1 Install MongoDB

```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

### 3.2 Configure MongoDB (Optional - for production)

```bash
# Edit MongoDB config
sudo nano /etc/mongod.conf

# Recommended settings:
# - Bind to localhost or specific IP
# - Enable authentication (for production)
# - Set up proper logging

# Restart MongoDB after changes
sudo systemctl restart mongod
```

### 3.3 Create MongoDB Database and User (Optional)

```bash
# Connect to MongoDB
mongosh

# Create database and user
use cofau_db
db.createUser({
  user: "cofau_user",
  pwd: "your_secure_password_here",
  roles: [{ role: "readWrite", db: "cofau_db" }]
})
exit
```

---

## 📦 Step 4: Clone and Setup Repository

### 4.1 Install Git

```bash
sudo apt install -y git
```

### 4.2 Clone Repository

```bash
cd /opt  # or /home/cofau or your preferred directory
sudo git clone <your-git-repository-url> cofau-backend
sudo chown -R $USER:$USER cofau-backend
cd cofau-backend
```

### 4.3 Navigate to Backend Directory

```bash
cd backend
```

---

## 🔧 Step 5: Setup Python Environment

### 5.1 Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 5.2 Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 🔐 Step 6: Configure Environment Variables

### 6.1 Create .env File

```bash
cd /opt/cofau-backend/backend  # or your path
nano .env
```

### 6.2 Add Environment Variables

```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
# Or with authentication:
# MONGO_URL=mongodb://cofau_user:your_password@localhost:27017/cofau_db?authSource=cofau_db

DATABASE_NAME=cofau_db

# JWT Configuration
SECRET_KEY=your-very-secure-secret-key-change-this-in-production-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Optional: File Upload Settings
UPLOAD_DIR=static/uploads
MAX_FILE_SIZE=10485760
```

### 6.3 Secure .env File

```bash
chmod 600 .env
```

---

## 📁 Step 7: Create Required Directories

```bash
# Create static file directories
mkdir -p static/uploads
mkdir -p static/uploads/profile_pictures
mkdir -p static/stories

# Set permissions
chmod -R 755 static
```

---

## 🚀 Step 8: Test Server Locally

### 8.1 Test Server Start

```bash
cd /opt/cofau-backend/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

### 8.2 Verify It Works

```bash
# In another terminal
curl http://localhost:8000/api
# Should return: {"message":"Cofau API is running","version":"1.0.0"}
```

Press `Ctrl+C` to stop the test server.

---

## 🔄 Step 9: Setup Process Manager (systemd)

### 9.1 Create systemd Service File

```bash
sudo nano /etc/systemd/system/cofau-backend.service
```

### 9.2 Add Service Configuration

```ini
[Unit]
Description=Cofau Backend API Server
After=network.target mongod.service

[Service]
Type=simple
User=cofau
Group=cofau
WorkingDirectory=/opt/cofau-backend/backend
Environment="PATH=/opt/cofau-backend/backend/venv/bin"
ExecStart=/opt/cofau-backend/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Important:** Update paths in the service file to match your actual installation path!

### 9.3 Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable cofau-backend

# Start service
sudo systemctl start cofau-backend

# Check status
sudo systemctl status cofau-backend

# View logs
sudo journalctl -u cofau-backend -f
```

---

## 🌐 Step 10: Setup Nginx Reverse Proxy

### 10.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 10.2 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/cofau-backend
```

### 10.3 Add Nginx Config

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or IP

    # Increase body size for file uploads
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Serve static files directly
    location /api/static/ {
        alias /opt/cofau-backend/backend/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 10.4 Enable Site

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/cofau-backend /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🔒 Step 11: Setup SSL with Let's Encrypt (Optional but Recommended)

### 11.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 11.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

### 11.3 Auto-Renewal

```bash
# Certbot sets up auto-renewal automatically
# Test renewal
sudo certbot renew --dry-run
```

---

## 🔥 Step 12: Configure Firewall

### 12.1 Setup UFW Firewall

```bash
# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MongoDB (only if needed from external)
# sudo ufw allow 27017/tcp  # Only if MongoDB needs external access

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📝 Step 13: Useful Commands

### Service Management

```bash
# Start server
sudo systemctl start cofau-backend

# Stop server
sudo systemctl stop cofau-backend

# Restart server
sudo systemctl restart cofau-backend

# Check status
sudo systemctl status cofau-backend

# View logs
sudo journalctl -u cofau-backend -f
sudo journalctl -u cofau-backend -n 100  # Last 100 lines
```

### Update Deployment

```bash
cd /opt/cofau-backend
git pull origin main  # or your branch name
cd backend
source venv/bin/activate
pip install -r requirements.txt  # Update dependencies if needed
sudo systemctl restart cofau-backend
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx
```

### MongoDB Commands

```bash
# Start MongoDB
sudo systemctl start mongod

# Stop MongoDB
sudo systemctl stop mongod

# Restart MongoDB
sudo systemctl restart mongod

# Check status
sudo systemctl status mongod

# Access MongoDB shell
mongosh
```

---

## 🐛 Troubleshooting

### Server Not Starting

```bash
# Check logs
sudo journalctl -u cofau-backend -n 50

# Check if port is in use
sudo netstat -tulpn | grep 8000

# Test server manually
cd /opt/cofau-backend/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

### MongoDB Connection Issues

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test MongoDB connection
mongosh
```

### Nginx Issues

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R cofau:cofau /opt/cofau-backend

# Fix permissions
chmod -R 755 /opt/cofau-backend/backend/static
```

---

## 📊 Monitoring (Optional)

### Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/cofau-backend
```

Add:

```
/var/log/cofau-backend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 cofau cofau
    sharedscripts
}
```

### Health Check Endpoint

The server already has a health check at `/api`:

```bash
curl http://your-domain.com/api
```

---

## 🔄 Quick Deployment Checklist

- [ ] VPS setup and updates
- [ ] Python 3.11+ installed
- [ ] MongoDB installed and running
- [ ] Repository cloned
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] .env file configured
- [ ] Static directories created
- [ ] Server tested locally
- [ ] systemd service created and enabled
- [ ] Nginx configured
- [ ] SSL certificate installed (optional)
- [ ] Firewall configured
- [ ] Server running and accessible

---

## 📞 Support

If you encounter issues:

1. Check service logs: `sudo journalctl -u cofau-backend -f`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
4. Verify all paths in systemd service file match your installation

---

## 🎯 Production Recommendations

1. **Use Environment Variables**: Never commit `.env` file
2. **Enable MongoDB Authentication**: For production databases
3. **Use Strong Secret Keys**: Generate secure random keys
4. **Setup Monitoring**: Consider tools like PM2, Supervisor, or monitoring services
5. **Regular Backups**: Backup MongoDB database regularly
6. **Keep Updated**: Regularly update system and dependencies
7. **Rate Limiting**: Consider adding rate limiting to prevent abuse
8. **Logging**: Setup proper logging and log rotation

---

**Your server should now be running at: `http://your-domain.com/api` or `http://your-ip/api`**
