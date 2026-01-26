#!/bin/bash
# Script to upload Firebase credentials to Expo EAS
# This is required for Android builds with Firebase

echo "📤 Uploading Firebase credentials to Expo EAS..."
echo ""

cd /root/backend/frontend

# Upload Google Services JSON for Android
echo "1. Uploading google-services.json for Android..."
npx eas credentials --platform android

echo ""
echo "✅ When prompted:"
echo "   - Select 'Google Services Account Key (JSON)' or 'Google Services File'"
echo "   - Choose 'Upload new'"
echo "   - Provide path: /root/backend/frontend/google-services.json"
echo ""
echo "📝 Note: The google-services.json file is already in the frontend directory"
echo "   and will be automatically used during the build."
