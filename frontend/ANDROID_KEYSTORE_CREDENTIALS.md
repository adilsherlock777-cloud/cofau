# 🔐 Android Keystore Credentials - Cofau App


This document contains your Android app signing credentials. Store this securely and never share it publicly.

---

## 📋 Keystore Information

### Keystore File Location
```
.credentials/cofau-release-keystore.jks
```

### Key Details
- **Key Alias**: `cofau-release-key`
- **Key Algorithm**: RSA
- **Key Size**: 2048 bits
- **Validity**: 10,000 days (27+ years)
- **Store Type**: PKCS12

---

## 🔑 Credentials

### Keystore Password
```
Yjq9zB3VFVLNRyI5
```

### Key Alias
```
cofau-release-key
```

### Key Password
```
Yjq9zB3VFVLNRyI5
```
*(Same as keystore password)*

---

## 📤 EAS Upload Instructions

### Step 1: Run EAS Credentials Command
```bash
cd /root/backend/frontend
eas credentials --platform android --profile production
```

### Step 2: Follow These Prompts

1. **"Which build profile do you want to configure?"**
   - Answer: `production`

2. **"What would you like to do?"**
   - Answer: `2` (Upload existing keystore)

3. **"Path to the keystore file:"**
   - Answer: `.credentials/cofau-release-keystore.jks`

4. **"Keystore password:"**
   - Answer: `Yjq9zB3VFVLNRyI5`

5. **"Key alias:"**
   - Answer: `cofau-release-key`

6. **"Key password:"**
   - Answer: `Yjq9zB3VFVLNRyI5`

---

## ✅ After Upload

Once uploaded to EAS, all future production builds will automatically use this keystore. You won't need to provide credentials again.


**Keystore File**: `.credentials/cofau-release-keystore.jks`  
**Key Alias**: `cofau-release-key`  
**Keystore Password**: `Yjq9zB3VFVLNRyI5`  
**Key Password**: `Yjq9zB3VFVLNRyI5`

---

**Generated**: January 4, 2025  
**Project**: Cofau App  
**Package**: com.cofau.app  
**Build Profile**: production

---

## 🆘 Recovery

If you need to recover the password:
```bash
cat .credentials/.keystore-password.txt
```

If you need to view keystore info:
```bash
cat .credentials/keystore-info.txt
```

---

**⚠️ IMPORTANT**: Keep this document secure. Losing the keystore or password means you cannot update your app on Play Store!

