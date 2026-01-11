#!/bin/bash

# Upload Android Keystore to EAS
# This script helps you upload the generated keystore to EAS Build

set -e

cd "$(dirname "$0")"

echo "📤 Upload Android Keystore to EAS"
echo "=================================="
echo ""

# Check if keystore exists
KEYSTORE_PATH=".credentials/cofau-release-keystore.jks"
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo "❌ Keystore not found: $KEYSTORE_PATH"
    echo "   Please run: ./generate-keystore.sh first"
    exit 1
fi

# Read credentials
PASSWORD_FILE=".credentials/.keystore-password.txt"
if [ ! -f "$PASSWORD_FILE" ]; then
    echo "❌ Password file not found: $PASSWORD_FILE"
    exit 1
fi

KEYSTORE_PASSWORD=$(cat "$PASSWORD_FILE")
KEY_ALIAS="cofau-release-key"

echo "📋 Keystore Information:"
echo "   File: $KEYSTORE_PATH"
echo "   Alias: $KEY_ALIAS"
echo "   Password: [hidden]"
echo ""
echo "🚀 Starting EAS credentials configuration..."
echo ""
echo "You'll be prompted to:"
echo "   1. Select 'production' profile"
echo "   2. Choose 'Upload existing keystore'"
echo "   3. Provide the keystore file path"
echo "   4. Provide the keystore password"
echo "   5. Provide the key alias"
echo "   6. Provide the key password"
echo ""
echo "Ready to proceed? (Press Enter to continue, Ctrl+C to cancel)"
read

# Display the password for easy copy-paste
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔐 KEYSTORE PASSWORD (copy this):"
echo "   $KEYSTORE_PASSWORD"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Key Alias: $KEY_ALIAS"
echo "Key Password: $KEYSTORE_PASSWORD (same as keystore password)"
echo ""

# Run EAS credentials command
echo "Starting EAS credentials configuration..."
eas credentials --platform android --profile production

echo ""
echo "✅ Credentials configuration complete!"
echo ""

