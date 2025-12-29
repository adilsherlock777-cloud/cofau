# iOS IPA Build Instructions

## Prerequisites

1. **Expo Account**: You need to be logged in as the project owner (`drivebay`) or have access to the project
2. **Apple Developer Account**: Required for production builds (optional for preview/ad-hoc builds)
3. **EAS CLI**: Will be installed automatically if not present

---

## Quick Build (Preview/Ad-Hoc IPA)

### Option 1: Using the Build Script (Recommended)

```bash
cd /root/backend/frontend
chmod +x build-ios-ipa.sh
./build-ios-ipa.sh
```

### Option 2: Using npm Script

```bash
cd /root/backend/frontend
npm run build:ios:ipa
```

### Option 3: Direct EAS Command

```bash
cd /root/backend/frontend
npx eas-cli build --platform ios --profile preview --clear-cache
```

---

## Step-by-Step Guide

### 1. Login to Expo

```bash
cd /root/backend/frontend
npx eas-cli login
```

**Note**: Login as the project owner (`drivebay`) or ensure you have access to the project.

### 2. Check Login Status

```bash
npx eas-cli whoami
```

### 3. Build iOS IPA

#### For Preview/Ad-Hoc (Testing):
```bash
npm run build:ios:preview
# or
npx eas-cli build --platform ios --profile preview --clear-cache
```

#### For Production (App Store):
```bash
npm run build:ios:production
# or
npx eas-cli build --platform ios --profile production --clear-cache
```

---

## iOS Credentials Setup

### First Time Setup

When building for iOS for the first time, EAS will ask you about credentials:

1. **Let EAS handle credentials automatically** (Recommended):
   - EAS will create and manage certificates, provisioning profiles, etc.
   - You'll need to provide your Apple Developer account credentials

2. **Provide credentials manually**:
   - You can provide your own certificates and provisioning profiles

### Required Information

If EAS asks for credentials, you'll need:

- **Apple ID**: Your Apple Developer account email
- **App-Specific Password**: Generate at https://appleid.apple.com
- **Team ID**: Your Apple Developer Team ID (found in Apple Developer Portal)

### Setting Up Credentials

```bash
# Configure credentials interactively
npx eas-cli credentials

# Or let EAS handle it automatically during build
npx eas-cli build --platform ios --profile preview
```

---

## Build Profiles

### Preview Profile (Ad-Hoc Distribution)
- **Purpose**: Testing on registered devices
- **Distribution**: Internal/Ad-Hoc
- **Use Case**: Share with clients/testers
- **Requirements**: Device UDIDs must be registered

### Production Profile (App Store)
- **Purpose**: App Store submission
- **Distribution**: App Store
- **Use Case**: Submit to App Store
- **Requirements**: Full Apple Developer account

---

## Monitor Build Progress

```bash
# List all builds
npx eas-cli build:list --platform ios

# View specific build
npx eas-cli build:view [BUILD_ID]

# Follow build logs
npx eas-cli build:view [BUILD_ID] --logs
```

---

## Download IPA

### Option 1: From Expo Dashboard
1. Visit: https://expo.dev/accounts/drivebay/projects/cofau-app/builds
2. Find your iOS build
3. Click "Download" when build completes

### Option 2: Via Command Line
```bash
npx eas-cli build:download [BUILD_ID]
```

---

## Installing IPA on iPhone

### Method 1: TestFlight (Recommended)
1. Upload IPA to App Store Connect
2. Add testers in TestFlight
3. Testers receive email invitation
4. Install TestFlight app and accept invitation

### Method 2: Direct Installation (Ad-Hoc)
1. Register device UDID in Apple Developer Portal
2. Download IPA file
3. Use tools like:
   - **AltStore**: https://altstore.io
   - **3uTools**: https://www.3u.com
   - **Xcode**: Drag IPA to Devices window
   - **Apple Configurator 2**: For enterprise distribution

### Method 3: Via EAS Submit
```bash
npx eas-cli submit --platform ios
```

---

## Device Registration (Ad-Hoc Builds)

For Ad-Hoc/preview builds, you need to register device UDIDs:

1. **Get Device UDID**:
   - Connect iPhone to Mac → Open Finder → Select device → Copy UDID
   - Or use: https://udid.tech

2. **Register in Apple Developer Portal**:
   - Go to: https://developer.apple.com/account/resources/devices/list
   - Click "+" → Add device → Enter UDID
   - Device will be included in next build

3. **Or let EAS handle it**:
   - EAS can automatically register devices during build
   - You'll be prompted to add devices

---

## Troubleshooting

### Build Fails - Credentials Error
```bash
# Clear and reconfigure credentials
npx eas-cli credentials
```

### Build Fails - Bundle Identifier
- Check `app.json` → `ios.bundleIdentifier` is correct
- Ensure it matches your Apple Developer account

### Build Fails - Provisioning Profile
```bash
# Let EAS regenerate credentials
npx eas-cli credentials --platform ios
```

### Permission Denied
- Ensure you're logged in as project owner
- Or ask owner to add you as collaborator

### Device Not Registered
- Add device UDID to Apple Developer Portal
- Rebuild after adding device

---

## Build Time

- **EAS Cloud Build**: 15-25 minutes
- **First Build**: May take longer (credential setup)

---

## Quick Commands Reference

```bash
# Login
npx eas-cli login

# Check login
npx eas-cli whoami

# Build Preview IPA
npm run build:ios:preview

# Build Production IPA
npm run build:ios:production

# List builds
npx eas-cli build:list --platform ios

# View build
npx eas-cli build:view [BUILD_ID]

# Download IPA
npx eas-cli build:download [BUILD_ID]

# Configure credentials
npx eas-cli credentials --platform ios

# Submit to App Store
npx eas-cli submit --platform ios
```

---

## Sharing IPA with Client

### Option 1: TestFlight (Best for Testing)
1. Build production IPA
2. Submit to App Store Connect
3. Add client as tester in TestFlight
4. Client receives email invitation

### Option 2: Direct Download Link
1. Build preview IPA
2. Download from Expo dashboard
3. Upload to file sharing service (Dropbox, Google Drive, etc.)
4. Share download link with client
5. Client installs via AltStore or similar tool

### Option 3: Enterprise Distribution
- Requires Apple Enterprise Developer account
- Can distribute without App Store
- Best for internal company apps

---

## Notes

- **Preview builds** are for testing and require device registration
- **Production builds** are for App Store submission
- First build may take longer due to credential setup
- IPA files are typically 50-200MB in size
- Builds are stored in Expo cloud for 30 days

---

## Support

If you encounter issues:
1. Check build logs: `npx eas-cli build:view [BUILD_ID] --logs`
2. Check Expo status: https://status.expo.dev
3. EAS documentation: https://docs.expo.dev/build/introduction/

