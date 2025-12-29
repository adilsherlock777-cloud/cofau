# Android APK Build Instructions

## Option 1: EAS Build (Recommended - Cloud Build)

### Prerequisites:
- Expo account with access to the project
- EAS CLI installed (or use npx)

### Steps:

1. **Login to Expo** (if not already logged in):
   ```bash
   cd /root/backend/frontend
   npx eas-cli login
   ```
   Note: You need to login as the project owner (`drivebay`) or have access to the project.

2. **Build APK using the script**:
   ```bash
   ./build-android-apk.sh
   ```

3. **Or build directly**:
   ```bash
   # Preview APK (for testing)
   npm run build:android:preview
   
   # Production APK (for release)
   npm run build:android:production
   ```

4. **Monitor build progress**:
   ```bash
   npx eas-cli build:list --platform android
   ```

5. **Download APK**:
   - Check your email for the download link
   - Or visit: https://expo.dev/accounts/drivebay/projects/cofau-app/builds

---

## Option 2: Local Build (Requires Java & Android SDK)

### Prerequisites:
- Java JDK 17 or higher
- Android SDK
- ANDROID_HOME environment variable set

### Steps:

1. **Install Java** (if not installed):
   ```bash
   sudo apt update
   sudo apt install openjdk-17-jdk -y
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   ```

2. **Set up Android SDK**:
   ```bash
   # Install Android SDK via Android Studio or command line tools
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

3. **Build APK**:
   ```bash
   cd /root/backend/frontend/android
   chmod +x gradlew
   ./gradlew assembleRelease
   ```

4. **Find APK**:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

---

## Quick Commands Reference

```bash
# Check EAS login
npx eas-cli whoami

# Login to Expo
npx eas-cli login

# Build Preview APK (cloud)
npm run build:android:preview

# Build Production APK (cloud)
npm run build:android:production

# List builds
npx eas-cli build:list --platform android

# View build details
npx eas-cli build:view [BUILD_ID]
```

---

## Troubleshooting

### Permission Error:
If you get "Entity not authorized" error:
- Login as the project owner: `npx eas-cli login`
- Or ask the project owner to add you as a collaborator

### Java Not Found:
- Install Java: `sudo apt install openjdk-17-jdk`
- Set JAVA_HOME: `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`

### Build Fails:
- Clear cache: `npm run clean`
- Check app.json configuration
- Verify all dependencies are installed: `npm install`

---

## Build Time
- EAS Cloud Build: 10-20 minutes
- Local Build: 5-10 minutes (after setup)

## APK Location
- EAS Build: Download from Expo dashboard
- Local Build: `android/app/build/outputs/apk/release/app-release.apk`

