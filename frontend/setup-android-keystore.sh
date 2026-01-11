#!/bin/bash

# Android Keystore Setup Script for Cofau App
# This script generates a keystore and configures it with EAS

set -e

echo "🔐 Android Keystore Setup for Production Builds"
echo ""

cd "$(dirname "$0")"

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo "❌ Error: keytool not found"
    echo "   Please install Java JDK:"
    echo "   sudo apt update && sudo apt install openjdk-17-jdk -y"
    exit 1
fi

# Check if EAS CLI is available
if ! command -v eas &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: EAS CLI not found"
    exit 1
fi

# Prompt for keystore password
echo "🔑 Please set a strong password for your Android keystore"
echo "   This password will be used to secure your app signing key"
echo "   IMPORTANT: Save this password securely - you'll need it for future builds!"
echo ""
read -sp "Enter keystore password (min 6 characters): " KEYSTORE_PASSWORD
echo ""
read -sp "Confirm keystore password: " KEYSTORE_PASSWORD_CONFIRM
echo ""

if [ "$KEYSTORE_PASSWORD" != "$KEYSTORE_PASSWORD_CONFIRM" ]; then
    echo "❌ Passwords do not match!"
    exit 1
fi

if [ ${#KEYSTORE_PASSWORD} -lt 6 ]; then
    echo "❌ Password must be at least 6 characters!"
    exit 1
fi

# Prompt for key alias password (can be same as keystore password)
echo ""
read -sp "Enter key alias password (press Enter to use same as keystore): " KEY_PASSWORD
if [ -z "$KEY_PASSWORD" ]; then
    KEY_PASSWORD="$KEYSTORE_PASSWORD"
fi
echo ""

# Keystore details
KEYSTORE_FILE="android-keystore.jks"
KEY_ALIAS="cofau-release-key"
KEYSTORE_DIR=".credentials"
KEYSTORE_PATH="$KEYSTORE_DIR/$KEYSTORE_FILE"

# Create credentials directory
mkdir -p "$KEYSTORE_DIR"

# Check if keystore already exists
if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  Keystore already exists at: $KEYSTORE_PATH"
    read -p "Do you want to overwrite it? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "❌ Aborted. Using existing keystore."
        exit 0
    fi
fi

# Generate keystore
echo ""
echo "📦 Generating Android keystore..."
echo "   Keystore file: $KEYSTORE_PATH"
echo "   Key alias: $KEY_ALIAS"
echo ""

keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=Cofau App, OU=Development, O=Cofau, L=Unknown, ST=Unknown, C=US"

echo ""
echo "✅ Keystore generated successfully!"
echo ""

# Save password to a secure file (with restricted permissions)
PASSWORD_FILE="$KEYSTORE_DIR/.keystore-password.txt"
echo "$KEYSTORE_PASSWORD" > "$PASSWORD_FILE"
chmod 600 "$PASSWORD_FILE"
echo "💾 Password saved to: $PASSWORD_FILE (restricted permissions)"

# Add to .gitignore if not already there
if ! grep -q "^\.credentials" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Android Keystore Credentials" >> .gitignore
    echo ".credentials/" >> .gitignore
    echo "✅ Added .credentials/ to .gitignore"
fi

echo ""
echo "📤 Now configuring EAS to use this keystore..."
echo "   You'll need to upload the keystore to EAS"
echo ""

# Try to configure EAS credentials
echo "Please run the following command to configure EAS:"
echo ""
echo "  eas credentials --platform android"
echo ""
echo "When prompted:"
echo "  1. Select 'production' profile"
echo "  2. Choose 'Set up a new keystore' or 'Upload existing keystore'"
echo "  3. Provide the keystore file: $KEYSTORE_PATH"
echo "  4. Provide the keystore password when asked"
echo "  5. Provide the key alias: $KEY_ALIAS"
echo "  6. Provide the key password when asked"
echo ""
echo "Or you can manually upload using:"
echo "  eas credentials --platform android --profile production"
echo ""
echo "✅ Keystore setup complete!"
echo ""
echo "📝 IMPORTANT:"
echo "   - Keystore location: $KEYSTORE_PATH"
echo "   - Key alias: $KEY_ALIAS"
echo "   - Password saved to: $PASSWORD_FILE"
echo "   - Keep these credentials secure!"
echo ""

