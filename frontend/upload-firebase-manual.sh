#!/bin/bash
# Manual upload script with clear instructions

echo "📤 Firebase Credentials Upload for Android Preview Profile"
echo "=========================================================="
echo ""
echo "✅ File ready: firebase-service-account.json"
echo ""
echo "🚀 Starting EAS credentials..."
echo ""
echo "📋 When prompted, make these selections:"
echo "   1. Platform: Android (already selected)"
echo "   2. Build profile: preview"
echo "   3. Action: Update credentials"
echo "   4. Credential type: Push Notifications (FCM V1): Google Service Account Key For FCM V1"
echo "   5. Upload method: Upload a file"
echo "   6. File path: ./firebase-service-account.json"
echo ""
echo "Press Enter to start..."
read

npx eas credentials --platform android

echo ""
echo "✅ Upload process completed!"
