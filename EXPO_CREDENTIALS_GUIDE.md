# 📤 Upload Firebase Credentials to Expo EAS

## Step-by-Step Guide

### Step 1: Run EAS Credentials Command

```bash
cd /root/backend/frontend
npx eas credentials
```

### Step 2: Follow the Interactive Prompts

1. **Select Platform:**
   ```
   ? Select platform: Android
   ```

2. **Select Build Profile:**
   ```
   ? Select build profile: production
   ```
   (or `preview` for testing)

3. **Select Credential Type:**
   ```
   ? What would you like to do?
   → Google Services Account Key (JSON)
   ```

4. **Choose Action:**
   ```
   ? What would you like to do with Google Services Account Key?
   → Upload new
   ```

5. **Provide File Path:**
   ```
   ? Path to the Google Services Account Key JSON file:
   /root/backend/frontend/google-services.json
   ```
   
   **OR** for service account (if prompted):
   ```
   /root/cofau/backend/credentials/firebase-credentials.json
   ```

### Step 3: Verify Upload

You should see:
```
✅ Google Services Account Key uploaded successfully
```

## Alternative: Non-Interactive Upload

If you need to automate this, you can use:

```bash
cd /root/backend/frontend
npx eas credentials --platform android --profile production
```

Then manually select the options when prompted.

## 📝 Important Notes

- **google-services.json** is for Android app configuration (already in frontend/)
- **firebase-credentials.json** (service account) is for backend FCM sending
- Both files are needed but serve different purposes
- Expo EAS needs the **google-services.json** for Android builds

## ✅ After Upload

Once credentials are uploaded, rebuild:

```bash
cd /root/backend/frontend
npx eas build --platform android --profile production --clear-cache
```

---

**The credentials are now stored on Expo's servers and will be used automatically during builds!** 🎉
