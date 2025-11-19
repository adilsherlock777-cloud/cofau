#!/bin/bash

# Cofau Backend Deployment Script for VPS
# Run this script after uploading your code to VPS

set -e  # Exit on error

echo "🚀 Starting Cofau Backend Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo -e "${YELLOW}Backend directory: $BACKEND_DIR${NC}"
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Error: Backend directory not found at $BACKEND_DIR${NC}"
    exit 1
fi

cd "$BACKEND_DIR"

# Step 1: Check Python
echo -e "${GREEN}Step 1: Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 not found. Please install Python 3.11+ first.${NC}"
    exit 1
fi
python3 --version
echo ""

# Step 2: Create virtual environment
echo -e "${GREEN}Step 2: Setting up virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi
source venv/bin/activate
echo ""

# Step 3: Upgrade pip
echo -e "${GREEN}Step 3: Upgrading pip...${NC}"
pip install --upgrade pip
echo ""

# Step 4: Install dependencies
echo -e "${GREEN}Step 4: Installing dependencies...${NC}"
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo "✅ Dependencies installed"
else
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi
echo ""

# Step 5: Create .env file if it doesn't exist
echo -e "${GREEN}Step 5: Checking .env file...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating template...${NC}"
    cat > .env << EOF
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=cofau_db

# JWT Configuration
SECRET_KEY=your-secret-key-change-this-in-production-min-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Server Configuration
HOST=0.0.0.0
PORT=8000

# File Upload Settings
UPLOAD_DIR=static/uploads
MAX_FILE_SIZE=10485760
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file and update SECRET_KEY and other values!${NC}"
    echo "   Run: nano $BACKEND_DIR/.env"
else
    echo "✅ .env file exists"
fi
chmod 600 .env
echo ""

# Step 6: Create required directories
echo -e "${GREEN}Step 6: Creating required directories...${NC}"
mkdir -p static/uploads
mkdir -p static/uploads/profile_pictures
mkdir -p static/stories
chmod -R 755 static
echo "✅ Directories created"
echo ""

# Step 7: Check MongoDB
echo -e "${GREEN}Step 7: Checking MongoDB...${NC}"
if systemctl is-active --quiet mongod; then
    echo "✅ MongoDB is running"
elif command -v mongod &> /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB is installed but not running. Starting...${NC}"
    sudo systemctl start mongod || echo -e "${YELLOW}⚠️  Could not start MongoDB. Please start it manually.${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB not found. Please install MongoDB first.${NC}"
    echo "   Run: sudo apt install -y mongodb-org"
fi
echo ""

# Step 8: Test server import
echo -e "${GREEN}Step 8: Testing server import...${NC}"
python -c "from server import app; print('✅ Server module loads successfully')" || {
    echo -e "${RED}❌ Failed to import server module${NC}"
    exit 1
}
echo ""

# Step 9: Create systemd service
echo -e "${GREEN}Step 9: Setting up systemd service...${NC}"
SERVICE_FILE="/etc/systemd/system/cofau-backend.service"
CURRENT_USER=$(whoami)

sudo tee $SERVICE_FILE > /dev/null << EOF
[Unit]
Description=Cofau Backend API Server
After=network.target mongod.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin"
ExecStart=$BACKEND_DIR/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "✅ systemd service file created"
sudo systemctl daemon-reload
sudo systemctl enable cofau-backend
echo "✅ Service enabled"
echo ""

# Step 10: Start the service
echo -e "${GREEN}Step 10: Starting service...${NC}"
sudo systemctl restart cofau-backend
sleep 2

if systemctl is-active --quiet cofau-backend; then
    echo -e "${GREEN}✅ Service is running!${NC}"
    sudo systemctl status cofau-backend --no-pager
else
    echo -e "${RED}❌ Service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u cofau-backend -n 50"
    exit 1
fi
echo ""

# Step 11: Test API endpoint
echo -e "${GREEN}Step 11: Testing API endpoint...${NC}"
sleep 2
if curl -s http://localhost:8000/api > /dev/null; then
    echo -e "${GREEN}✅ API is responding!${NC}"
    curl -s http://localhost:8000/api | python -m json.tool || curl -s http://localhost:8000/api
else
    echo -e "${YELLOW}⚠️  API not responding yet. It may still be starting...${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📋 Useful Commands:"
echo "   Status:  sudo systemctl status cofau-backend"
echo "   Logs:    sudo journalctl -u cofau-backend -f"
echo "   Restart: sudo systemctl restart cofau-backend"
echo "   Stop:    sudo systemctl stop cofau-backend"
echo ""
echo "🌐 Server should be running at: http://localhost:8000/api"
echo ""
echo "⚠️  Next Steps:"
echo "   1. Setup Nginx reverse proxy (see VPS_DEPLOYMENT_GUIDE.md)"
echo "   2. Configure firewall: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
echo "   3. Setup SSL certificate (optional)"
echo ""

