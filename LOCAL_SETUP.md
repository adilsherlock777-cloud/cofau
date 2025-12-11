# Local Development Setup Guide

## Problem: Videos Not Loading Locally

When running the code locally, videos may not load because the application is trying to access the production server (`https://backend.cofau.com`) instead of your local backend.

## Solution: Configure Environment Variables

### Backend Configuration

1. Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env  # If .env.example exists, or create manually
```

2. Add the following to `backend/.env`:

```env
# For local development
BACKEND_URL=http://localhost:8000

# Your MongoDB connection string
MONGO_URL=your_mongodb_connection_string

# Sightengine API credentials (if using content moderation)
SIGHTENGINE_API_USER=your_user
SIGHTENGINE_API_SECRET=your_secret
```

3. The backend will now use `http://localhost:8000` for constructing absolute URLs.

### Frontend Configuration

For Expo/React Native, you have several options:

#### Option 1: Using Environment Variable (Recommended)

1. Create a `.env` file in the `frontend/` directory:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

2. Make sure you have `expo-constants` installed and the app reads from environment variables.

#### Option 2: Using Shell Environment Variable

Before starting the Expo development server:

```bash
export EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
npx expo start
```

#### Option 3: Update app.json (Temporary)

Edit `frontend/app.json` and change:

```json
"extra": {
  "EXPO_PUBLIC_BACKEND_URL": "http://localhost:8000",
  "apiUrl": "http://localhost:8000"
}
```

**Note:** Remember to change this back before deploying to production!

### Important Notes

1. **Backend Port**: Make sure your backend is running on port 8000 (or update the URL accordingly).

2. **CORS**: The backend already has CORS configured to allow all origins (`allow_origins=["*"]`), so local development should work.

3. **Network Access**: If testing on a physical device:
   - Use your computer's local IP address instead of `localhost`
   - Example: `http://192.168.1.100:8000`
   - Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

4. **Video Loading**: After setting these environment variables:
   - Restart both backend and frontend servers
   - Clear the app cache if needed
   - Videos should now load from your local backend

### Verification

1. Check backend logs - you should see the configured `BACKEND_URL` in startup messages
2. Check frontend console - video URLs should point to `http://localhost:8000` (or your configured URL)
3. Test video loading in the app

## Production Deployment

For production, set:
- Backend: `BACKEND_URL=https://backend.cofau.com`
- Frontend: `EXPO_PUBLIC_BACKEND_URL=https://backend.cofau.com`

