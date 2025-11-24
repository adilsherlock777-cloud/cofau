#!/bin/bash

# Script to restart the backend server with PM2
# This ensures WebSocket support is properly loaded

echo "🔄 Restarting Cofau Backend with PM2..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Please install it first:"
    echo "   npm install -g pm2"
    exit 1
fi

# Install/update Python dependencies (using virtual environment)
echo "📦 Installing/updating Python dependencies..."
if [ -d "venv" ]; then
    ./venv/bin/pip install -r requirements.txt
else
    echo "⚠️  Virtual environment not found. Installing system-wide (may require --break-system-packages)"
    pip install -r requirements.txt --break-system-packages 2>/dev/null || pip install -r requirements.txt
fi

# Restart PM2 process
echo ""
echo "🔄 Restarting PM2 process..."
pm2 restart cofau-backend || pm2 restart backend || pm2 restart all

# Show PM2 status
echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "✅ Backend restarted successfully!"
echo ""
echo "📝 To view logs, run:"
echo "   pm2 logs cofau-backend"
echo ""
echo "📝 To monitor, run:"
echo "   pm2 monit"

