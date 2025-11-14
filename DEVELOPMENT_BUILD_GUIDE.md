# 📱 Cofau App - Development Build Guide

## ✅ Configuration Complete

Your app is now configured for development builds with:
- **App Name**: Cofau
- **Bundle ID (iOS)**: com.cofau.app
- **Package Name (Android)**: com.cofau.app
- **EAS Build**: Configured and ready

---

## 🚀 Building Your App

### Prerequisites

1. **Create an Expo Account** (if you don't have one)
   - Go to https://expo.dev
   - Sign up for a free account
   - You'll need this for the build service

2. **Choose Your Platform**
   - Android: Easier to start with, no developer account needed for testing
   - iOS: Requires Apple Developer account ($99/year)

---

## 📦 Option A: Build Android APK (Recommended for Testing)

### Step 1: Login to Expo Account

You'll need to run this command from your local machine or terminal with access to your Expo project:

```bash
cd /app/frontend
npx eas-cli login
```

Enter your Expo credentials when prompted.

### Step 2: Build the Development APK

```bash
cd /app/frontend
npx eas-cli build --platform android --profile development
```

**What happens:**
- EAS will upload your code to Expo's build servers
- A development APK will be built (takes 10-15 minutes)
- You'll get a download link when complete

### Step 3: Install on Android Device

1. Download the APK from the link provided
2. Transfer to your Android phone (or download directly)
3. Enable "Install from Unknown Sources" in Android settings
4. Install the APK
5. Open the app and start testing!

---

## 🍎 Option B: Build iOS App (Requires Apple Developer Account)

### Prerequisites for iOS:
- Apple Developer Account ($99/year)
- Apple ID credentials

### Step 1: Build iOS Development Build

```bash
cd /app/frontend
npx eas-cli build --platform ios --profile development
```

### Step 2: Install on iPhone

**Method 1: Ad Hoc Distribution**
- Register your device UDID with Apple
- Download and install via TestFlight or direct installation

**Method 2: TestFlight (Recommended)**
- Use the preview profile
- Distribute to testers via TestFlight

---

## 🔧 Alternative: Local Development Build

If you want to build locally instead of using EAS cloud service:

### Android (Requires Android Studio)
```bash
cd /app/frontend
npx expo run:android --variant debug
```

### iOS (Requires Xcode on Mac)
```bash
cd /app/frontend
npx expo run:ios --configuration Debug
```

---

## ⚡ Quick Testing with Expo Go (No Build Needed)

If you just want to test quickly without building:

1. **Download Expo Go**
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

2. **Get QR Code from your preview**
   - Your app: https://foodsocial-app.preview.emergentagent.com
   - Scan QR code with Expo Go app

3. **Instant Testing**
   - No build process needed
   - Great for quick iterations

---

## 📝 Build Profiles Explained

We've configured three build profiles in `eas.json`:

### 1. **development** (Current Setup)
- For active development and testing
- Includes developer tools
- Larger file size
- Best for: Testing on real devices during development

### 2. **preview**
- For internal testing/QA
- Smaller than development builds
- No dev tools
- Best for: Sharing with testers before production

### 3. **production**
- For app store submission
- Optimized and minified
- Smallest file size
- Best for: Final release to App Store/Play Store

---

## 🔑 Important Notes

### Backend Connection
Your app is configured to connect to:
- **Backend URL**: `https://foodsocial-app.preview.emergentagent.com/api`

**For Production Builds**, you'll need to:
1. Deploy your backend to a permanent server (not the preview URL)
2. Update `EXPO_PUBLIC_BACKEND_URL` in your `.env` file
3. Rebuild the app

### Environment Variables
Current configuration in `.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://foodsocial-app.preview.emergentagent.com
EXPO_PUBLIC_API_URL=https://foodsocial-app.preview.emergentagent.com/api
```

---

## 🛠️ Build Commands Summary

| Command | Purpose |
|---------|---------|
| `npx eas-cli build --platform android --profile development` | Android development APK |
| `npx eas-cli build --platform ios --profile development` | iOS development build |
| `npx eas-cli build --platform android --profile preview` | Android preview APK |
| `npx eas-cli build --platform android --profile production` | Production Android build |
| `npx eas-cli build --platform ios --profile production` | Production iOS build |
| `npx eas-cli build --platform all --profile development` | Build both platforms |

---

## 📊 Build Status & Management

After starting a build:

1. **Check Build Status**
   ```bash
   npx eas-cli build:list
   ```

2. **View Build Details**
   - Go to https://expo.dev
   - Navigate to your project
   - View build history and logs

3. **Download Builds**
   - Builds are available for 30 days
   - Download from the link provided
   - Or from expo.dev dashboard

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs on expo.dev
- Ensure all dependencies are properly installed
- Verify app.json configuration

### App Won't Install on Android
- Enable "Install from Unknown Sources"
- Check Android version compatibility
- Try uninstalling previous version

### iOS Installation Issues
- Verify device UDID is registered
- Check provisioning profile
- Ensure Apple Developer account is active

---

## 📱 Testing Checklist

Once your build is installed:

- [ ] Login/Signup works
- [ ] Feed displays posts with images
- [ ] Can create new posts with images
- [ ] Profile loads user data correctly
- [ ] Explore screen shows content
- [ ] Navigation between screens works
- [ ] Images load from backend
- [ ] Like/comment functionality works
- [ ] Camera/gallery access works
- [ ] App doesn't crash on device

---

## 🎯 Next Steps

1. **Build Android Development APK** (Easiest to start)
   ```bash
   cd /app/frontend
   npx eas-cli login
   npx eas-cli build --platform android --profile development
   ```

2. **Test on Real Device**
   - Install the APK
   - Test all features
   - Note any issues

3. **Iterate**
   - Fix issues found during testing
   - Rebuild as needed
   - Repeat until satisfied

4. **Production Build** (When ready)
   - Deploy backend to production server
   - Update environment variables
   - Build production version
   - Submit to app stores

---

## 💡 Pro Tips

- **Start with Android**: Easier to build and test, no developer account needed
- **Use Expo Go for Quick Tests**: Great for UI/UX iterations
- **Development Builds for Features**: Test device-specific features (camera, notifications)
- **Keep Backend Running**: Your preview backend URL must be accessible for the app to work
- **Version Control**: Keep track of which build version has which features

---

## 📞 Need Help?

- Expo Documentation: https://docs.expo.dev
- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Expo Forums: https://forums.expo.dev

---

**Ready to build?** Run the Android development build command above to get started! 🚀
