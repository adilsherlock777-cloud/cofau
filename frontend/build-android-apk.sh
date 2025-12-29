#!/bin/bash

# Android APK Build Script for Cofau App
# This script builds the Android APK using EAS Build (Expo Cloud)

set -e

echo "🚀 Starting Android APK Build Process..."
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")"

# Check if EAS CLI is available
if ! command -v eas &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: EAS CLI or npx not found"
    echo "   Please install: npm install -g eas-cli"
    exit 1
fi

# Check login status
echo "🔐 Checking Expo account..."
if npx eas-cli whoami &> /dev/null; then
    USER=$(npx eas-cli whoami)
    echo "✅ Logged in as: $USER"
else
    echo "❌ Not logged in to Expo"
    echo "   Please run: npx eas-cli login"
    exit 1
fi

# Check project owner
OWNER=$(cat app.json | grep -A 1 '"owner"' | grep -o '"[^"]*"' | tr -d '"')
echo "📦 Project owner: $OWNER"
echo ""

# Ask user which build profile to use
echo "Select build profile:"
echo "1) Preview (APK for testing)"
echo "2) Production (APK for release)"
read -p "Enter choice [1-2] (default: 1): " choice
choice=${choice:-1}

case $choice in
    1)
        PROFILE="preview"
        echo "✅ Building Preview APK..."
        ;;
    2)
        PROFILE="production"
        echo "✅ Building Production APK..."
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📦 Starting EAS Build..."
echo "   This will build in the cloud (takes 10-20 minutes)"
echo "   You'll receive a download link when complete"
echo ""

# Start the build
npx eas-cli build --platform android --profile $PROFILE --clear-cache

echo ""
echo "✅ Build started successfully!"
echo ""
echo "📱 Next steps:"
echo "   1. Check your email for build status"
echo "   2. Or run: npx eas-cli build:list"
echo "   3. Download APK from: https://expo.dev/accounts/$OWNER/projects/cofau-app/builds"
echo ""

