#!/bin/bash

# iOS IPA Build Script for Cofau App
# This script builds an iOS IPA file using EAS Build (cloud build)

set -e

echo "🍎 Building iOS IPA for Cofau App..."
echo ""

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

# Navigate to frontend directory
cd "$(dirname "$0")"

echo "📦 Building iOS IPA (Preview/Ad-Hoc)..."
echo "   This will create an IPA file that can be installed on registered devices"
echo ""

# Build iOS IPA
npx eas-cli build --platform ios --profile preview --clear-cache

echo ""
echo "✅ Build started!"
echo ""
echo "📱 To monitor build progress:"
echo "   npx eas-cli build:list --platform ios"
echo ""
echo "📥 Download IPA from:"
echo "   https://expo.dev/accounts/drivebay/projects/cofau-app/builds"
echo ""
echo "💡 Note: You'll need to:"
echo "   1. Register your device UDID in Apple Developer Portal"
echo "   2. Download the IPA when build completes"
echo "   3. Install via TestFlight or direct installation"

