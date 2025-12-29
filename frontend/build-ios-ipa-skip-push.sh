#!/bin/bash

# iOS IPA Build Script - Skip Push Notifications Setup
# Use this if you've reached the APNs key limit

set -e

echo "🍎 Building iOS IPA for Cofau App (Skipping Push Setup)..."
echo ""

cd "$(dirname "$0")"

# Check if EAS CLI is available
if ! command -v eas &> /dev/null; then
    echo "⚠️  EAS CLI not found. Installing via npx..."
    npm install -g eas-cli
fi

# Check if logged in
echo "🔐 Checking EAS login status..."
if ! npx eas-cli whoami &> /dev/null; then
    echo "❌ Not logged in to EAS. Please login first:"
    echo "   npx eas-cli login"
    exit 1
fi

echo "✅ Logged in to EAS"
echo ""

echo "📦 Building iOS IPA (Preview/Ad-Hoc)..."
echo "   Note: When asked about Push Notifications, answer 'No' to skip"
echo ""

# Build iOS IPA - answer "No" when asked about push notifications
echo "No" | npx eas-cli build --platform ios --profile preview --clear-cache

echo ""
echo "✅ Build started!"
echo ""
echo "📱 To monitor build progress:"
echo "   npx eas-cli build:list --platform ios"
echo ""
echo "📥 Download IPA from:"
echo "   https://expo.dev/accounts/drivebay/projects/cofau-app/builds"

