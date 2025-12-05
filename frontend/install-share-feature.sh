#!/bin/bash

# Installation script for Share Feature
echo "🚀 Installing Share Feature Dependencies..."

# Install npm packages
echo "📦 Installing npm packages..."
npm install react-native-view-shot expo-sharing expo-file-system

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
    
    # Check if running on iOS
    if [ -d "ios" ]; then
        echo "📱 Detected iOS project, installing pods..."
        cd ios && pod install && cd ..
        
        if [ $? -eq 0 ]; then
            echo "✅ iOS pods installed successfully!"
        else
            echo "⚠️  Pod installation failed. Please run 'cd ios && pod install' manually."
        fi
    fi
    
    echo ""
    echo "✨ Installation complete!"
    echo ""
    echo "📖 Next steps:"
    echo "1. Run 'expo prebuild' if using Expo"
    echo "2. Run 'npm run android' or 'npm run ios' to rebuild"
    echo "3. Check SHARE_FEATURE_README.md for usage instructions"
    echo ""
else
    echo "❌ Installation failed. Please check the error messages above."
    exit 1
fi
