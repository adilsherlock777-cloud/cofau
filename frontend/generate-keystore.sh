#!/bin/bash

# Generate Android Keystore with Password
# This creates a secure keystore for Android AAB production builds

set -e

cd "$(dirname "$0")"

echo "🔐 Android Keystore Generator for Cofau App"
echo "=========================================="
echo ""

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo "❌ Error: keytool not found. Installing Java JDK..."
    sudo apt update && sudo apt install openjdk-17-jdk -y || {
        echo "❌ Failed to install Java. Please install manually."
        exit 1
    }
fi

# Generate a secure random password if not provided
if [ -z "$KEYSTORE_PASSWORD" ]; then
    # Generate a secure 16-character password
    KEYSTORE_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    echo "🔑 Generated secure password: $KEYSTORE_PASSWORD"
    echo "   ⚠️  SAVE THIS PASSWORD SECURELY - You'll need it for EAS!"
    echo ""
else
    echo "🔑 Using provided password"
    echo ""
fi

# Keystore configuration
KEYSTORE_DIR=".credentials"
KEYSTORE_FILE="cofau-release-keystore.jks"
KEYSTORE_PATH="$KEYSTORE_DIR/$KEYSTORE_FILE"
KEY_ALIAS="cofau-release-key"

# Create credentials directory
mkdir -p "$KEYSTORE_DIR"

# Check if keystore exists
if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  Keystore already exists!"
    read -p "Overwrite? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ] && [ "$OVERWRITE" != "Y" ]; then
        echo "❌ Aborted."
        exit 0
    fi
    rm -f "$KEYSTORE_PATH"
fi

echo "📦 Generating keystore..."
echo "   Location: $KEYSTORE_PATH"
echo "   Alias: $KEY_ALIAS"
echo ""

# Generate the keystore
keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEYSTORE_PASSWORD" \
    -dname "CN=Cofau App, OU=Mobile, O=Cofau, L=Unknown, ST=Unknown, C=US" \
    2>&1 | grep -v "Warning:" || true

echo ""
echo "✅ Keystore generated successfully!"
echo ""

# Save password securely
PASSWORD_FILE="$KEYSTORE_DIR/.keystore-password.txt"
echo "$KEYSTORE_PASSWORD" > "$PASSWORD_FILE"
chmod 600 "$PASSWORD_FILE"

# Save credentials info
CREDENTIALS_INFO="$KEYSTORE_DIR/keystore-info.txt"
cat > "$CREDENTIALS_INFO" << EOF
Android Keystore Credentials
============================
Keystore File: $KEYSTORE_PATH
Key Alias: $KEY_ALIAS
Keystore Password: $KEYSTORE_PASSWORD
Key Password: $KEYSTORE_PASSWORD

IMPORTANT: Keep this information secure!
Do not commit these files to version control.
EOF

chmod 600 "$CREDENTIALS_INFO"

# Update .gitignore
if ! grep -q "\.credentials" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Android Keystore Credentials" >> .gitignore
    echo ".credentials/" >> .gitignore
fi

echo "📝 Credentials saved to:"
echo "   - Password: $PASSWORD_FILE"
echo "   - Info: $CREDENTIALS_INFO"
echo ""
echo "🔐 KEYSTORE PASSWORD: $KEYSTORE_PASSWORD"
echo ""
echo "📤 Next Steps:"
echo "   1. Upload keystore to EAS:"
echo "      eas credentials --platform android --profile production"
echo ""
echo "   2. When prompted:"
echo "      - Choose 'Upload existing keystore'"
echo "      - Provide keystore file: $KEYSTORE_PATH"
echo "      - Provide password: $KEYSTORE_PASSWORD"
echo "      - Provide key alias: $KEY_ALIAS"
echo "      - Provide key password: $KEYSTORE_PASSWORD"
echo ""
echo "✅ Setup complete! Your keystore is ready for production builds."
echo ""

