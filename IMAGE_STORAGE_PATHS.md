# Image Storage Paths - Cofau Application

This document shows where all images are saved in the application.

> **✅ UNIFIED STORAGE**: All images (profile pictures, stories, and feed images) are now stored in the **same folder** for consistency and easier management.

## 📁 Folder Structure

```
backend/
└── static/
    └── uploads/                    # ALL images stored here (unified)
        ├── profile_*.jpg          # Profile pictures
        ├── story_*.jpg/.mp4       # Story images/videos
        └── {objectid}_*.jpg       # Feed/post images
```

---

## 🎯 Unified Storage Path

### **Local File Path (Server)**

```
static/uploads/
```

All images are stored in this single directory:

- **Profile Pictures**: `static/uploads/profile_{user_id}_{timestamp}.{ext}`
- **Story Images/Videos**: `static/uploads/story_{user_id}_{uuid8}.{ext}`
- **Feed Images**: `static/uploads/{objectid}_{original_filename}`

### **URL Path (Database/API)**

```
/api/static/uploads/{filename}
```

### **Full URL (Frontend Access)**

```
https://backend.cofau.com/api/static/uploads/{filename}
```

---

## 1. 📸 Profile Picture Images

### **Local File Path (Server)**

```
static/uploads/
```

### **Full File Path Example**

```
static/uploads/profile_691b562fa896fb9d55eeb006_20241215_143022.jpg
```

### **Filename Format**

```
profile_{user_id}_{timestamp}.{extension}
```

- `user_id`: MongoDB ObjectId of the user
- `timestamp`: Format `YYYYMMDD_HHMMSS` (e.g., `20241215_143022`)
- `extension`: `jpg`, `jpeg`, `png`, `gif`

### **URL Path (Database/API)**

```
/api/static/uploads/{filename}
```

### **Full URL (Frontend Access)**

```
https://backend.cofau.com/api/static/uploads/profile_691b562fa896fb9d55eeb006_20241215_143022.jpg
```

### **Code Location**

- **Upload Endpoint**: `backend/routers/profile_picture.py` (line 13, 37)
- **Upload Handler**: `backend/routers/profile_picture.py` (line 17-89)

### **Migration Notes**

- Old profile pictures used `/legacy-static/uploads/profile_pictures/` URL format
- Frontend automatically converts legacy URLs to new format
- Old files in `backend/static/uploads/profile_pictures/` can be migrated manually if needed

---

## 2. 🎬 Story Images & Videos

### **Local File Path (Server)**

```
static/uploads/
```

### **Full File Path Example**

```
static/uploads/story_691b562fa896fb9d55eeb006_e1e92be1.mp4
```

### **Filename Format**

```
story_{user_id}_{uuid8}.{extension}
```

- `user_id`: MongoDB ObjectId of the user
- `uuid8`: First 8 characters of UUID (e.g., `e1e92be1`)
- `extension`: `jpg`, `jpeg`, `png`, `webp`, `mp4`, `mov`

### **URL Path (Database/API)**

```
/api/static/uploads/{filename}
```

### **Full URL (Frontend Access)**

```
https://backend.cofau.com/api/static/uploads/story_691b562fa896fb9d55eeb006_e1e92be1.mp4
```

### **Code Location**

- **Upload Endpoint**: `backend/routers/stories.py` (line 16, 42)
- **Upload Handler**: `backend/routers/stories.py` (line 20-78)

### **Migration Notes**

- Old stories used `/api/static/stories/` URL format
- Frontend automatically converts old story URLs to new format
- Old files in `/app/backend/static/stories/` or `backend/static/stories/` can be migrated manually if needed

---

## 3. 📱 Feed Images (Post Images)

### **Local File Path (Server)**

```
static/uploads/
```

### **Full File Path Example**

```
static/uploads/691b562fa896fb9d55eeb006_2593BD87-A3E6-4A3E-BF45-90245F10EE11.jpg
```

### **Filename Format**

```
{objectid}_{original_filename}
```

- `objectid`: MongoDB ObjectId (unique identifier)
- `original_filename`: Original filename from user's device

### **URL Path (Database/API)**

```
/api/static/uploads/{filename}
```

### **Full URL (Frontend Access)**

```
https://backend.cofau.com/api/static/uploads/691b562fa896fb9d55eeb006_2593BD87-A3E6-4A3E-BF45-90245F10EE11.jpg
```

### **Code Location**

- **Upload Endpoint**: `backend/server.py` (line 89-147)
- **Config**: `backend/config.py` (line 18) - `UPLOAD_DIR = "static/uploads"`

---

## 📋 Summary Table

| Image Type              | Local Folder Path | Filename Pattern                      | URL Path                         | Full URL Example                                                                |
| ----------------------- | ----------------- | ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| **Profile Pictures**    | `static/uploads/` | `profile_{user_id}_{timestamp}.{ext}` | `/api/static/uploads/{filename}` | `https://backend.cofau.com/api/static/uploads/profile_xxx_20241215_143022.jpg`  |
| **Story Images/Videos** | `static/uploads/` | `story_{user_id}_{uuid8}.{ext}`       | `/api/static/uploads/{filename}` | `https://backend.cofau.com/api/static/uploads/story_xxx_e1e92be1.mp4`           |
| **Feed Images**         | `static/uploads/` | `{objectid}_{original_filename}`      | `/api/static/uploads/{filename}` | `https://backend.cofau.com/api/static/uploads/691b562fa896fb9d55eeb006_xxx.jpg` |

---

## 🔍 Static File Serving Configuration

The backend serves static files through FastAPI's StaticFiles:

```python
# From backend/server.py (line 47-52)
STATIC_DIR = os.path.join(BASE_DIR, "static")  # /root/cofau/backend/static
app.mount("/api/static", StaticFiles(directory=STATIC_DIR), name="static")
```

This means:

- Files in `backend/static/` are accessible via `/api/static/`
- Example: `backend/static/uploads/image.jpg` → `https://backend.cofau.com/api/static/uploads/image.jpg`

---

## 📝 Notes

1. **Unified Storage**: All images (profile, story, feed) are stored in `static/uploads/` for consistency
2. **URL Format**: All images use `/api/static/uploads/{filename}` URL format
3. **Frontend Compatibility**: Frontend automatically converts old URL formats to new unified format
4. **Stories**: Expire after 24 hours (automatic cleanup available)
5. **Feed Images**: Can be both images and videos (mp4, mov)
6. **All paths are relative to the backend directory** (from `backend/config.py`)

---

## 🛠️ Accessing Files on Server

If you need to access files directly on the server:

```bash
# All images (unified location)
cd static/uploads/

# Or from backend directory
cd backend/static/uploads/
```

---

## 🔄 Migration from Old Paths

### Profile Pictures

- **Old URL**: `/legacy-static/uploads/profile_pictures/{filename}`
- **New URL**: `/api/static/uploads/{filename}`
- **Frontend**: Automatically converts old URLs

### Stories

- **Old URL**: `/api/static/stories/{filename}`
- **New URL**: `/api/static/uploads/{filename}`
- **Frontend**: Automatically converts old URLs

### Feed Images

- **No change needed** - already using correct path

---

## ✅ Benefits of Unified Storage

1. **Consistency**: All images use the same path structure
2. **Easier Management**: Single directory to manage all uploads
3. **Better Performance**: Simplified file serving
4. **Frontend Compatibility**: Automatic URL conversion for old images
5. **Backward Compatible**: Old URLs are automatically handled
