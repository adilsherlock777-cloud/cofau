#!/bin/bash

# Automated Keystore Upload to EAS
# This script attempts to upload the keystore automatically

set -e

cd "$(dirname "$0")"

KEYSTORE_PATH=".credentials/cofau-release-keystore.jks"
PASSWORD_FILE=".credentials/.keystore-password.txt"
KEYSTORE_PASSWORD=$(cat "$PASSWORD_FILE")
KEY_ALIAS="cofau-release-key"

echo "📤 Uploading Android Keystore to EAS"
echo "====================================="
echo ""
echo "Keystore: $KEYSTORE_PATH"
echo "Alias: $KEY_ALIAS"
echo ""

# Check if expect is available for automation
if command -v expect &> /dev/null; then
    echo "✅ Using expect for automated upload..."
    expect << EOF
spawn eas credentials --platform android --profile production
expect {
    "Which build profile" {
        send "production\r"
        exp_continue
    }
    "What would you like to do" {
        send "2\r"
        exp_continue
    }
    "Path to the keystore file" {
        send "$KEYSTORE_PATH\r"
        exp_continue
    }
    "Keystore password" {
        send "$KEYSTORE_PASSWORD\r"
        exp_continue
    }
    "Key alias" {
        send "$KEY_ALIAS\r"
        exp_continue
    }
    "Key password" {
        send "$KEYSTORE_PASSWORD\r"
        exp_continue
    }
    "successfully" {
        puts "\n✅ Upload successful!"
        exit 0
    }
    timeout {
        puts "\n⚠️  Timeout - please run manually"
        exit 1
    }
}
EOF
else
    echo "⚠️  expect not available - providing manual instructions"
    echo ""
    echo "Please run this command manually:"
    echo "  eas credentials --platform android --profile production"
    echo ""
    echo "When prompted, use these values:"
    echo "  Profile: production"
    echo "  Action: Upload existing keystore (option 2)"
    echo "  Keystore file: $KEYSTORE_PATH"
    echo "  Keystore password: $KEYSTORE_PASSWORD"
    echo "  Key alias: $KEY_ALIAS"
    echo "  Key password: $KEYSTORE_PASSWORD"
    exit 1
fi

