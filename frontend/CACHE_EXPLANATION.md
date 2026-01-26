# EAS Build Cache Explanation

## ⚠️ Important: Understanding Cache Behavior

When you run:
```bash
cd /root/backend/frontend && npx eas-cli build --platform ios --profile preview --clear-cache --non-interactive
```

### What `--clear-cache` Does:
✅ **Clears EAS SERVER-SIDE cache only:**
- CocoaPods cache on the build server
- npm package cache on the build server  
- Native iOS build artifacts on EAS servers

### What `--clear-cache` Does NOT Do:
❌ **Does NOT clear LOCAL caches:**
- Metro bundler cache (`.metro`, `node_modules/.cache`)
- Expo cache (`.expo`)
- Watchman cache (if installed)
- Local npm cache

### How EAS Build Works:
1. **EAS uploads your LOCAL project directory** to their build servers
2. If your local files have stale cached content, **that stale content gets uploaded**
3. `--clear-cache` only clears the cache **on the EAS server**, not locally

---

## 🎯 Two Types of Caches

### 1. **EAS Server Cache** (Cleared by `--clear-cache`)
- Where: On Expo's build servers
- What: Native dependencies (CocoaPods, npm packages)
- Why: Speeds up builds by reusing downloaded packages
- Cleared by: `--clear-cache` flag ✅

### 2. **Local Cache** (NOT cleared by `--clear-cache`)
- Where: On your local machine
- What: Metro bundler, Expo cache, transformed files
- Why: Speeds up local development
- Cleared by: Manual cleanup or `npm run clean` ❌

---

## ✅ Solutions: Ensuring Latest Code

### Option 1: Quick Build (EAS cache only)
```bash
cd /root/backend/frontend
npx eas-cli build --platform ios --profile preview --clear-cache --non-interactive
```
**Use this when:**
- ✅ You've saved all your code changes
- ✅ No Metro/Expo cache issues
- ✅ You want a faster build (skips local cleanup)

### Option 2: Fresh Build (All caches cleared)
```bash
cd /root/backend/frontend
./build-ios-ipa-fresh.sh
```
**Or manually:**
```bash
cd /root/backend/frontend
npm run clean  # Clears local caches
npx eas-cli build --platform ios --profile preview --clear-cache --non-interactive
```
**Use this when:**
- ✅ You suspect cache issues
- ✅ After major code changes
- ✅ You want 100% certainty of fresh code
- ✅ Build time is not critical

### Option 3: Using npm script (Recommended)
```bash
cd /root/backend/frontend
npm run build:ios:ipa
```
This runs: `npm run clean && eas build --platform ios --profile preview --clear-cache`

---

## 📋 What Gets Uploaded to EAS?

EAS uploads **your entire local `frontend/` directory**, including:
- ✅ All your source code (`app/`, `components/`, etc.)
- ✅ `package.json` and `package-lock.json`
- ✅ `app.json` configuration
- ✅ Assets (`assets/`)
- ❌ **NOT uploaded:** `.expo`, `node_modules`, `android/`, `ios/` (generated)

**Important:** EAS re-installs `node_modules` on their servers, so your local `node_modules` doesn't matter. But your **source code** is what gets uploaded!

---

## 🔍 How to Verify Latest Code is Uploaded

### Check Before Building:
```bash
cd /root/backend/frontend

# Verify your code changes are saved
git status  # If using git
git diff    # See what changed

# Check file timestamps
ls -la app/  # See when files were last modified

# Verify no cached builds
ls -la .expo node_modules/.cache  # Check if these exist
```

### Check During Build:
```bash
# Watch build logs (shows what files are uploaded)
npx eas-cli build --platform ios --profile preview --clear-cache

# Look for "Uploading to EAS" - this shows file sizes
# If file sizes seem old, local cache might be stale
```

---

## 🐛 Common Cache Issues

### Issue 1: Code changes not reflected in build
**Cause:** Local Metro/Expo cache
**Solution:** 
```bash
npm run clean
npx eas-cli build --platform ios --profile preview --clear-cache
```

### Issue 2: Build is slow even with `--clear-cache`
**Cause:** Large `node_modules` being uploaded (rare)
**Solution:** EAS should ignore `node_modules`, but check `.easignore`

### Issue 3: Old dependencies in build
**Cause:** Old `package-lock.json` or cached packages
**Solution:**
```bash
rm package-lock.json
npm install
npx eas-cli build --platform ios --profile preview --clear-cache
```

---

## 📊 Comparison Table

| Command | Local Cache | EAS Cache | Uploads Latest Code |
|---------|-------------|-----------|---------------------|
| `eas build --clear-cache` | ❌ No | ✅ Yes | ✅ Usually |
| `npm run clean && eas build --clear-cache` | ✅ Yes | ✅ Yes | ✅ **Always** |
| `./build-ios-ipa-fresh.sh` | ✅ Yes | ✅ Yes | ✅ **Always** |

---

## 💡 Best Practice

**For production builds, always use:**
```bash
npm run build:ios:ipa
# or
./build-ios-ipa-fresh.sh
```

**For quick testing builds:**
```bash
npx eas-cli build --platform ios --profile preview --clear-cache
```

---

## 🎯 Answer to Your Question

**Q: If I run `npx eas-cli build --platform ios --profile preview --clear-cache --non-interactive`, will it take updated code or same/remaining old cache code?**

**A:** It will take **your latest saved code** from your local directory, but:
- ✅ EAS server cache is cleared
- ⚠️ Local caches (Metro, Expo) are **NOT cleared**
- ⚠️ If local caches contain stale transformed files, those might affect the build

**To be 100% sure:**
```bash
npm run clean && npx eas-cli build --platform ios --profile preview --clear-cache --non-interactive
```

Or use the new script:
```bash
./build-ios-ipa-fresh.sh
```
