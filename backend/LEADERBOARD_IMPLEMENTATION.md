# Leaderboard System Implementation

## Overview

This document describes the complete implementation of the content leaderboard system based on image/video quality scores and user engagement.

## Architecture

### 1. Quality Scoring (Sightengine Integration)

**File**: `backend/utils/sightengine_quality.py`

The system uses Sightengine API to analyze media quality and generate a score from 0-100.

#### Quality Score Components:
- **Sharpness** (30% weight): Image/video clarity
- **Contrast** (20% weight): Visual contrast quality (optimal around 0.5)
- **Brightness** (20% weight): Lighting quality (optimal around 0.5)
- **Colors** (30% weight): Color vibrancy and diversity

#### Formula:
```python
quality_score = (sharpness * 0.30) + (contrast_normalized * 0.20) + 
                (brightness_normalized * 0.20) + (colors * 0.30)
```

#### API Configuration:
```python
SIGHTENGINE_API_USER = settings.SIGHTENGINE_API_USER
SIGHTENGINE_API_SECRET = settings.SIGHTENGINE_API_SECRET
```

### 2. Engagement Scoring

**File**: `backend/routers/leaderboard.py`

Engagement is calculated based on likes count, normalized against the maximum likes in the current 3-day window.

#### Formula:
```python
engagement_score = (likes_count / max_likes_in_window) * 100
```

### 3. Combined Scoring

The final leaderboard score combines quality and engagement:

#### Formula:
```python
combined_score = (0.6 * quality_score) + (0.4 * engagement_score)
```

#### Weights (Configurable):
- **Quality Weight**: 60% - Emphasizes content quality
- **Engagement Weight**: 40% - Rewards user interaction

**To adjust weights**, modify these constants in `backend/routers/leaderboard.py`:
```python
QUALITY_WEIGHT = 0.6  # 60% weight for quality score
ENGAGEMENT_WEIGHT = 0.4  # 40% weight for engagement score
```

### 4. Leaderboard Window

- **Duration**: 3 days (rolling window)
- **Top N**: 10 posts
- **Auto-refresh**: Every 3 days at 10:00 AM

## Database Schema

### Posts Collection
```javascript
{
  _id: ObjectId,
  user_id: String,
  media_url: String,
  media_type: String, // "image" or "video"
  caption: String,
  location_name: String,
  likes_count: Number,
  comments_count: Number,
  quality_score: Number, // 0-100 from Sightengine
  engagement_score: Number, // Calculated dynamically
  combined_score: Number, // Weighted average
  created_at: ISODate
}
```

### Leaderboard Snapshots Collection
```javascript
{
  _id: ObjectId,
  from_date: ISODate, // Start of 3-day window
  to_date: ISODate, // End of 3-day window
  generated_at: ISODate, // When snapshot was created
  window_days: Number, // 3
  total_posts_analyzed: Number,
  entries: [
    {
      rank: Number, // 1-10
      post_id: String,
      user_id: String,
      username: String,
      user_profile_picture: String,
      media_url: String,
      media_type: String,
      caption: String,
      location_name: String,
      quality_score: Number,
      likes_count: Number,
      engagement_score: Number,
      combined_score: Number,
      created_at: ISODate
    }
  ],
  config: {
    quality_weight: Number,
    engagement_weight: Number,
    leaderboard_size: Number
  }
}
```

## API Endpoints

### 1. Get Current Leaderboard
```
GET /api/leaderboard/current
Authorization: Bearer {token}
```

**Response**:
```json
{
  "from_date": "2025-12-07T10:00:00",
  "to_date": "2025-12-10T10:00:00",
  "generated_at": "2025-12-10T10:00:00",
  "window_days": 3,
  "total_posts_analyzed": 150,
  "entries": [
    {
      "rank": 1,
      "post_id": "...",
      "username": "John Doe",
      "media_url": "/api/static/uploads/...",
      "caption": "Amazing food!",
      "quality_score": 92.5,
      "likes_count": 150,
      "engagement_score": 100.0,
      "combined_score": 95.5
    }
  ],
  "config": {
    "quality_weight": 0.6,
    "engagement_weight": 0.4
  }
}
```

### 2. Get Leaderboard History
```
GET /api/leaderboard/history?skip=0&limit=10
Authorization: Bearer {token}
```

Returns past leaderboard snapshots.

### 3. Regenerate Leaderboard (Manual)
```
POST /api/leaderboard/regenerate
Authorization: Bearer {token}
```

Manually triggers leaderboard regeneration without waiting for scheduled job.

### 4. Get Post Score Details
```
GET /api/leaderboard/post/{post_id}/score
Authorization: Bearer {token}
```

Returns detailed score breakdown for a specific post.

## Scheduler

**File**: `backend/utils/scheduler.py`

### Configuration:
- **Schedule**: Every 3 days at 10:00 AM
- **Cron Expression**: `0 10 */3 * *`
- **Library**: APScheduler (AsyncIOScheduler)

### Job Process:
1. Determine 3-day window (current time - 3 days to current time)
2. Fetch all posts within that window
3. Calculate engagement scores (normalize by max likes)
4. Calculate combined scores
5. Sort by combined score descending
6. Take top 10 posts
7. Save snapshot to database

### Starting the Scheduler:
The scheduler starts automatically when the FastAPI server starts (in `lifespan` context manager).

### Manual Execution:
```python
from utils.scheduler import run_job_now
await run_job_now()
```

## Post Creation Flow

**File**: `backend/server.py` - `/api/posts/create`

### Process:
1. User uploads image/video
2. File is saved to server
3. **Content moderation** check (Sightengine)
4. **Quality scoring** (Sightengine) - NEW
5. Post is saved to database with quality_score
6. Initial combined_score = quality_score * 0.6 (no engagement yet)
7. User level is updated
8. Followers are notified

### Quality Scoring Integration:
```python
from utils.sightengine_quality import analyze_media_quality

# Build full URL for Sightengine API
backend_url = os.getenv("BACKEND_URL", "https://api.cofau.com")
full_media_url = f"{backend_url}{media_url}"

# Analyze quality
quality_score = await analyze_media_quality(full_media_url, media_type)

# Save in post document
post_doc = {
    ...
    "quality_score": quality_score,
    "engagement_score": 0.0,
    "combined_score": quality_score * 0.6,
    ...
}
```

## Frontend Implementation

**File**: `frontend/app/leaderboard.tsx`

### Features:
- Real-time leaderboard data from API
- Pull-to-refresh functionality
- Loading and error states
- Top 3 posts highlighted with gold border
- Score breakdown (Quality, Likes, Combined)
- Click to view post details
- Date range display
- Empty state handling

### Data Flow:
1. Component mounts → fetch leaderboard
2. Display loading spinner
3. On success → render entries
4. On error → show retry button
5. Pull to refresh → refetch data

### UI Components:
- **Rank Badge**: Shows position (1-10), gold for top 3
- **Media Thumbnail**: Post image/video preview
- **User Info**: Username, caption, location
- **Score Cards**: Quality, Likes, Combined score with icons

## Installation & Setup

### 1. Install Dependencies

**Backend**:
```bash
cd backend
pip install -r requirements.txt
```

New dependencies added:
- `httpx` - For async HTTP requests to Sightengine
- `apscheduler` - For scheduled jobs

### 2. Environment Variables

Add to `.env`:
```env
SIGHTENGINE_API_USER=your_api_user
SIGHTENGINE_API_SECRET=your_api_secret
BACKEND_URL=https://api.cofau.com
```

### 3. Start Server

```bash
cd backend
python server.py
```

The scheduler will start automatically and log:
```
✅ ========================================
✅ SCHEDULER STARTED
✅ Job: Leaderboard Regeneration
✅ Schedule: Every 3 days at 10:00 AM
✅ Next run: 2025-12-13 10:00:00
✅ ========================================
```

### 4. Frontend

No additional setup required. The leaderboard screen will automatically fetch data from the API.

## Testing

### 1. Test Quality Scoring
```python
from utils.sightengine_quality import analyze_media_quality

# Test with an image URL
score = await analyze_media_quality(
    "https://api.cofau.com/api/static/uploads/test.jpg",
    "image"
)
print(f"Quality Score: {score}")
```

### 2. Test Leaderboard Generation
```python
from routers.leaderboard import generate_leaderboard_snapshot

snapshot = await generate_leaderboard_snapshot()
print(f"Generated snapshot with {len(snapshot['entries'])} entries")
```

### 3. Test Scheduler
```python
from utils.scheduler import run_job_now

# Run the job immediately
await run_job_now()
```

### 4. Test API Endpoints

**Get Current Leaderboard**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.cofau.com/api/leaderboard/current
```

**Regenerate Leaderboard**:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.cofau.com/api/leaderboard/regenerate
```

## Monitoring & Logs

### Scheduler Logs:
```
🏆 ========================================
🏆 SCHEDULED LEADERBOARD REGENERATION STARTED
🏆 Time: 2025-12-10T10:00:00
🏆 ========================================
📊 Found 150 posts in window
✅ ========================================
✅ LEADERBOARD REGENERATION COMPLETED
✅ Snapshot ID: 675...
✅ Entries: 10
✅ Window: 2025-12-07T10:00:00 to 2025-12-10T10:00:00
✅ ========================================
```

### Quality Scoring Logs:
```
✅ Quality score calculated: 87.5 for https://api.cofau.com/api/static/uploads/...
```

### Error Handling:
```
❌ ========================================
❌ LEADERBOARD REGENERATION FAILED
❌ Error: Connection timeout
❌ ========================================
```

## Customization

### Adjust Score Weights

Edit `backend/routers/leaderboard.py`:
```python
QUALITY_WEIGHT = 0.7  # 70% quality
ENGAGEMENT_WEIGHT = 0.3  # 30% engagement
```

### Change Leaderboard Window

```python
LEADERBOARD_WINDOW_DAYS = 7  # 7-day window instead of 3
```

### Change Leaderboard Size

```python
LEADERBOARD_SIZE = 20  # Top 20 instead of top 10
```

### Adjust Scheduler Frequency

Edit `backend/utils/scheduler.py`:
```python
scheduler.add_job(
    regenerate_leaderboard_job,
    trigger=CronTrigger(
        minute=0,
        hour=10,
        day='*/7',  # Every 7 days instead of 3
        month='*',
        day_of_week='*'
    ),
    ...
)
```

## Troubleshooting

### Issue: Quality scores are all 50.0
**Solution**: Check Sightengine API credentials in `.env` file.

### Issue: Leaderboard is empty
**Solution**: 
1. Check if posts exist in the 3-day window
2. Manually regenerate: `POST /api/leaderboard/regenerate`
3. Check logs for errors

### Issue: Scheduler not running
**Solution**:
1. Check server logs for scheduler startup message
2. Verify APScheduler is installed: `pip install apscheduler`
3. Check for errors in `utils/scheduler.py`

### Issue: Frontend shows "Failed to load leaderboard"
**Solution**:
1. Check if backend is running
2. Verify API endpoint: `GET /api/leaderboard/current`
3. Check authentication token
4. Check browser console for errors

## Future Enhancements

1. **Admin Dashboard**: Web interface to view/manage leaderboards
2. **Multiple Categories**: Separate leaderboards for different food types
3. **User Notifications**: Notify users when they enter the leaderboard
4. **Badges/Rewards**: Award badges to top performers
5. **Historical Charts**: Visualize score trends over time
6. **Video Quality**: Enhanced video analysis (currently uses first frame)
7. **AI Recommendations**: Suggest improvements to increase quality score
8. **Leaderboard Filters**: Filter by location, cuisine type, etc.

## Support

For issues or questions:
1. Check logs in `backend/` directory
2. Review API responses
3. Test individual components (quality scoring, scheduler, etc.)
4. Contact development team

---

**Last Updated**: December 10, 2025
**Version**: 1.0.0

