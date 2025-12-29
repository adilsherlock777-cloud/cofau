# Fix: Apple Push Notification Key Limit Error

## Problem
```
You have already reached the maximum allowed number of team scoped Keys 
for this service in production and sandbox environment.
```

This means your Apple Developer account has reached the maximum number of APNs (Apple Push Notification) keys allowed per team.

## Solutions

### ✅ Solution 1: Skip Push Notification Setup (Recommended for Now)

Your app uses **Expo Push Notifications**, which works through Expo's service, so you don't need APNs keys for basic functionality.

**Run the build and answer "No" when asked about push notifications:**

```bash
cd /root/backend/frontend
npx eas-cli build --platform ios --profile preview --clear-cache
```

When prompted:
- **"Do you want to log in to your Apple account?"** → Answer: **Yes**
- **"Would you like to set up Push Notifications?"** → Answer: **No** ← This is the key!

The build will continue without APNs keys. Your app will still work, and Expo Push Notifications will function through Expo's service.

---

### Solution 2: Use Existing APNs Key

If you have an existing APNs key, you can configure EAS to use it:

1. **List existing credentials:**
   ```bash
   cd /root/backend/frontend
   npx eas-cli credentials --platform ios
   ```

2. **Select "Push Notifications Key"**
3. **Choose "Use existing key"**
4. **Provide your existing APNs key**

---

### Solution 3: Delete Old APNs Keys (If You Have Access)

If you have access to Apple Developer Portal, you can delete unused keys:

1. Go to: https://developer.apple.com/account/resources/authkeys/list
2. Find unused/old APNs keys
3. Delete them (you can only delete keys that aren't in use)
4. Try building again

**Note:** You can only delete keys that aren't currently being used by any apps.

---

### Solution 4: Configure Credentials Manually First

Set up credentials manually to skip push notifications:

```bash
cd /root/backend/frontend

# Configure credentials
npx eas-cli credentials --platform ios

# When asked:
# - Select "Push Notifications Key"
# - Choose "Skip" or "No"
# - Continue with other credentials setup
```

Then run the build:
```bash
npx eas-cli build --platform ios --profile preview --clear-cache
```

---

## Quick Fix Command

Run this command and answer **"No"** when asked about push notifications:

```bash
cd /root/backend/frontend
npx eas-cli build --platform ios --profile preview --clear-cache
```

**Interactive prompts:**
1. ✅ "Do you want to log in to your Apple account?" → **Yes**
2. ✅ "Would you like to set up Push Notifications?" → **No** ← Important!
3. Continue with other credentials...

---

## Why This Works

- **Expo Push Notifications** uses Expo's push notification service
- Your app code uses `expo-notifications` which works with Expo's service
- You don't need native APNs keys for Expo Push Notifications to work
- The app will function normally, notifications will work through Expo

---

## After Build Completes

1. **Monitor build:**
   ```bash
   npx eas-cli build:list --platform ios
   ```

2. **Download IPA:**
   - Visit: https://expo.dev/accounts/drivebay/projects/cofau-app/builds
   - Or: `npx eas-cli build:download [BUILD_ID]`

---

## If You Need Native Push Notifications Later

If you need native iOS push notifications in the future:

1. Delete unused APNs keys from Apple Developer Portal
2. Or use an existing APNs key
3. Reconfigure credentials:
   ```bash
   npx eas-cli credentials --platform ios
   ```

---

## Summary

**The easiest solution:** Just answer **"No"** when asked about push notifications during the build. Your app will work fine with Expo Push Notifications!

