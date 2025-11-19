# Android APK Build Guide - Cofau App

Complete guide to build Android APK with updated code and no cache issues.

## 📋 Prerequisites

1. **EAS CLI installed**:

   ```bash
   npm install -g eas-cli
   ```

2. **EAS Account**:

   ```bash
   eas login
   ```

3. **Expo Account** (if not already logged in)

## 🚀 Quick Build (Recommended)

### Step 1: Clean Cache and Build

**On Windows (PowerShell):**

```powershell
cd frontend
.\build-apk.ps1
npm run build:android:apk
```

**On Mac/Linux:**

```bash
cd frontend
chmod +x build-apk.sh
./build-apk.sh
npm run build:android:apk
```

### Step 2: Follow EAS Build Prompts

EAS will ask:

- Build type: Choose **APK** (not AAB)
- Build profile: Choose **preview** or **production**

## 📝 Manual Build Steps

### Step 1: Update Version (Already Done)

Version updated to **1.0.1** with versionCode **2** in `app.json`

### Step 2: Clean All Caches

```bash
cd frontend

# Clear Expo cache
npx expo start --clear

# Clear Metro bundler cache
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro

# Clear package manager cache
npm cache clean --force
# OR if using yarn
yarn cache clean

# Remove old build artifacts
rm -rf android ios dist build
```

### Step 3: Build APK with EAS

**Option A: Preview Build (Recommended for testing)**

```bash
eas build --platform android --profile preview --clear-cache
```

**Option B: Production Build**

```bash
eas build --platform android --profile production --clear-cache
```

**Option C: Development Build**

```bash
eas build --platform android --profile development --clear-cache
```

### Step 4: Download APK

After build completes:

1. EAS will provide a download link
2. Or check your EAS dashboard: https://expo.dev/accounts/[your-account]/projects/cofau-app/builds

## 🔧 Build Configuration

### Current Build Settings

**Version**: 1.0.1  
**Version Code**: 2  
**Package**: com.cofau.app  
**Build Type**: APK

### EAS Build Profiles

Located in `frontend/eas.json`:

- **preview**: Internal distribution APK
- **production**: Production APK
- **development**: Development client

## ⚠️ Important Notes

### 1. Cache Clearing

The `--clear-cache` flag ensures:

- ✅ Fresh build without cached code
- ✅ Latest changes are included
- ✅ No stale dependencies

### 2. Version Updates

When updating code:

1. Update `version` in `app.json` (e.g., 1.0.1 → 1.0.2)
2. Increment `versionCode` in `app.json` (e.g., 2 → 3)
3. Always increment versionCode for each new build

### 3. Build Time

- First build: ~15-20 minutes
- Subsequent builds: ~10-15 minutes
- Builds are done on EAS servers (cloud build)

## 🐛 Troubleshooting

### Issue: Build uses old code

**Solution:**

```bash
# Clear all caches
npm run clean:cache

# Rebuild with cache clearing
eas build --platform android --profile preview --clear-cache
```

### Issue: Version conflict

**Solution:**

1. Check `app.json` - ensure versionCode is incremented
2. Check EAS dashboard for existing builds
3. Increment versionCode if needed

### Issue: Build fails

**Solution:**

1. Check EAS build logs in dashboard
2. Ensure all dependencies are installed: `npm install`
3. Check `eas.json` configuration
4. Verify EAS account is logged in: `eas whoami`

### Issue: APK not downloading

**Solution:**

1. Check EAS dashboard for build status
2. Ensure build completed successfully
3. Download from EAS dashboard directly

## 📦 Build Commands Reference

```bash
# Clean cache only
npm run clean:cache

# Clean everything
npm run clean

# Build preview APK (with cache clear)
npm run build:android:preview

# Build production APK (with cache clear)
npm run build:android:production

# Full clean build (recommended)
npm run build:android:apk
```

## ✅ Verification Checklist

Before building:

- [ ] Version updated in `app.json`
- [ ] VersionCode incremented
- [ ] All code changes committed
- [ ] Dependencies installed (`npm install`)
- [ ] EAS CLI installed and logged in

After building:

- [ ] Build completed successfully
- [ ] APK downloaded
- [ ] Test APK on device
- [ ] Verify images/videos load correctly
- [ ] Check version in app settings

## 🎯 Quick Reference

**Most Common Build Command:**

```bash
cd frontend
npm run build:android:apk
```

**Or with EAS directly:**

```bash
cd frontend
eas build --platform android --profile preview --clear-cache
```

## 📱 Testing the APK

After downloading:

1. Transfer APK to Android device
2. Enable "Install from Unknown Sources" in device settings
3. Install APK
4. Test all features:
   - Feed posts (images/videos)
   - Profile pictures
   - Stories
   - Image uploads

## 🔄 Next Build

For future builds:

1. Update version: `1.0.1` → `1.0.2`
2. Update versionCode: `2` → `3`
3. Run: `npm run build:android:apk`

---

**Your APK will include all the latest image/video URL fixes!** 🎉
