#!/bin/bash

# Clean Build Script for Cofau Android APK
# This script ensures a fresh build without cache issues

echo "🧹 Cleaning build cache and artifacts..."
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")"

# Clear Expo cache
echo "1️⃣ Clearing Expo cache..."
npx expo start --clear

# Clear Metro bundler cache
echo "2️⃣ Clearing Metro bundler cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro

# Clear watchman cache (if installed)
if command -v watchman &> /dev/null; then
    echo "3️⃣ Clearing Watchman cache..."
    watchman watch-del-all
fi

# Clear npm/yarn cache
echo "4️⃣ Clearing package manager cache..."
npm cache clean --force 2>/dev/null || yarn cache clean

# Remove build artifacts
echo "5️⃣ Removing old build artifacts..."
rm -rf android
rm -rf ios
rm -rf dist
rm -rf build

# Clear EAS build cache
echo "6️⃣ Clearing EAS build cache..."
eas build:cancel --non-interactive 2>/dev/null || true

echo ""
echo "✅ Cache cleared successfully!"
echo ""
echo "📦 Ready to build APK. Run one of these commands:"
echo "   - npm run build:android:preview   (for preview APK)"
echo "   - npm run build:android:production (for production APK)"
echo ""
echo "Or use EAS directly:"
echo "   - eas build --platform android --profile preview --clear-cache"
echo ""

