# Leaderboard Filtration System - Complete Explanation

## Overview
The leaderboard system ranks posts based on a 3-day rolling window, calculating scores from:
- **Image Quality** (50% weight)
- **Post Likes/Engagement** (30% weight)  
- **Number of Posts Uploaded** (20% weight)

---

## 🔧 BACKEND FILTRATION PROCESS

### Step 1: Date Window Calculation
**Location:** `backend/routers/leaderboard.py` lines 133-135

```python
to_date = datetime.utcnow()  # Current UTC time
from_date = to_date - timedelta(days=LEADERBOARD_WINDOW_DAYS)  # 3 days ago
```

**Example:**
- If today is **December 13, 2024 at 2:00 PM UTC**
- `to_date` = `2024-12-13T14:00:00`
- `from_date` = `2024-12-10T14:00:00` (3 days earlier)

**Why "Dec 10 - Dec 13"?**
- The system calculates: **Current Date - 3 days = Start Date**
- So if today is Dec 13, it shows posts from Dec 10 to Dec 13
- This is a **rolling 3-day window** that updates every time the leaderboard is generated

---

### Step 2: Database Query - Filter Posts by Date
**Location:** `backend/routers/leaderboard.py` lines 141-146

```python
posts = await db.posts.find({
    "created_at": {
        "$gte": from_date.isoformat(),  # Greater than or equal to Dec 10
        "$lte": to_date.isoformat()     # Less than or equal to Dec 13
    }
}).to_list(None)
```

**What this does:**
- Queries MongoDB for all posts where `created_at` is between `from_date` and `to_date`
- Only posts uploaded within the last 3 days are included
- Uses MongoDB's `$gte` (greater than or equal) and `$lte` (less than or equal) operators

---

### Step 3: Calculate User Post Counts
**Location:** `backend/routers/leaderboard.py` lines 157-169

```python
user_post_counts = {}
for post in posts:
    user_id = str(post.get("user_id", ""))
    if user_id:
        user_post_counts[user_id] = user_post_counts.get(user_id, 0) + 1

max_post_count = max(user_post_counts.values())
```

**What this does:**
- Counts how many posts each user uploaded in the 3-day window
- Example: User A uploaded 5 posts, User B uploaded 2 posts
- Finds the maximum count (5 in this example) for score normalization

---

### Step 4: Calculate Scores for Each Post
**Location:** `backend/routers/leaderboard.py` lines 176-194

For each post, the system calculates:

1. **Quality Score** (0-100)
   - Already stored in `post.quality_score` from Sightengine API
   - Measures image/video quality

2. **Engagement Score** (0-100)
   ```python
   engagement_score = (likes_count / max_likes) * 100
   ```
   - Normalizes likes count against the maximum likes in the 3-day window
   - Example: If max likes = 100, and post has 50 likes → 50% engagement score

3. **Post Count Score** (0-100)
   ```python
   post_count_score = (user_post_count / max_post_count) * 100
   ```
   - Normalizes user's post count against the maximum post count
   - Example: If max posts = 5, and user uploaded 3 posts → 60% post count score

4. **Combined Score** (0-100)
   ```python
   combined_score = (0.5 * quality_score) + (0.3 * engagement_score) + (0.2 * post_count_score)
   ```
   - Weighted average of all three scores
   - Example: Quality=80, Engagement=60, Post Count=50
   - Combined = (0.5×80) + (0.3×60) + (0.2×50) = 40 + 18 + 10 = **68.0**

---

### Step 5: Sort and Filter Top 10
**Location:** `backend/routers/leaderboard.py` lines 241-249

```python
posts_with_scores.sort(key=lambda x: x["combined_score"], reverse=True)
top_posts = posts_with_scores[:LEADERBOARD_SIZE]  # Top 10
```

**What this does:**
- Sorts all posts by `combined_score` (highest first)
- Takes only the top 10 posts
- Assigns ranks (1, 2, 3, ..., 10)

---

### Step 6: Save Snapshot with Date Range
**Location:** `backend/routers/leaderboard.py` lines 252-265

```python
snapshot = {
    "from_date": from_date.isoformat(),  # "2024-12-10T14:00:00"
    "to_date": to_date.isoformat(),       # "2024-12-13T14:00:00"
    "window_days": 3,
    "entries": top_posts,
    ...
}
```

**What this does:**
- Saves the leaderboard snapshot to MongoDB
- Includes the exact date range used for filtering
- This snapshot is reused until it becomes outdated (>3 days old)

---

## 📱 FRONTEND DISPLAY PROCESS

### Step 1: Fetch Leaderboard Data
**Location:** `frontend/app/leaderboard.tsx` lines 32-75

```typescript
const response = await axios.get(`${BACKEND_URL}/api/leaderboard/current`, {
    headers: { Authorization: `Bearer ${token}` }
});
```

**What this does:**
- Makes HTTP GET request to `/api/leaderboard/current`
- Backend returns the most recent snapshot with `from_date` and `to_date`

---

### Step 2: Parse Date Strings
**Location:** `frontend/app/leaderboard.tsx` lines 58-59

```typescript
const fromDate = data.from_date || threeDaysAgo.toISOString();
const toDate = data.to_date || now.toISOString();
```

**What this does:**
- Receives ISO date strings from backend: `"2024-12-10T14:00:00"` and `"2024-12-13T14:00:00"`
- Stores them in component state

---

### Step 3: Format Dates for Display
**Location:** `frontend/app/leaderboard.tsx` lines 103-134

```typescript
const formatDate = (dateString: string) => {
    // Parse ISO string: "2024-12-10T14:00:00"
    let date = new Date(dateString + 'Z');  // Add UTC indicator
    
    // Get month and day using UTC methods
    const monthNames = ['Jan', 'Feb', 'Mar', ..., 'Dec'];
    const month = monthNames[date.getUTCMonth()];  // Gets "Dec" for month 11
    const day = date.getUTCDate();  // Gets 10
    
    return `${month} ${day}`;  // Returns "Dec 10"
};
```

**Why "Dec 10 - Dec 13" shows:**
1. Backend sends: `from_date = "2024-12-10T14:00:00"` and `to_date = "2024-12-13T14:00:00"`
2. Frontend parses these ISO strings
3. Extracts month abbreviation ("Dec") and day number (10, 13)
4. Displays: `"Dec 10 - Dec 13"`

**Why UTC methods?**
- Backend uses `datetime.utcnow()` (UTC timezone)
- Frontend must use `getUTCMonth()` and `getUTCDate()` to avoid timezone conversion
- If we used `getMonth()`, it would convert to local timezone and might show wrong dates

---

### Step 4: Display Date Range
**Location:** `frontend/app/leaderboard.tsx` lines 188-193

```typescript
<Text style={styles.dateRange}>
    {formatDate(leaderboardData.from_date)} - {formatDate(leaderboardData.to_date)}
    {leaderboardData.window_days && ` (${leaderboardData.window_days} days)`}
</Text>
```

**What this displays:**
- `"Dec 10 - Dec 13 (3 days)"`
- Shows the exact date range used for filtering
- The "(3 days)" indicates it's a 3-day rolling window

---

## 🔄 REGENERATION LOGIC

### When Does Leaderboard Regenerate?

**Location:** `backend/routers/leaderboard.py` lines 318-348

The leaderboard regenerates automatically when:

1. **No snapshot exists** → Generate new one
2. **Snapshot is >3 days old** → Regenerate
3. **Manual trigger** → POST `/api/leaderboard/regenerate`

**Check logic:**
```python
if (current_date - snapshot_date).days > LEADERBOARD_WINDOW_DAYS:
    # Regenerate leaderboard
    new_snapshot = await generate_leaderboard_snapshot()
```

**Example:**
- Snapshot was created on Dec 10
- Today is Dec 14 (4 days later)
- System detects snapshot is outdated → Regenerates with new window (Dec 11 - Dec 14)

---

## 📊 COMPLETE FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    USER OPENS LEADERBOARD                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: fetchLeaderboard()                                │
│  GET /api/leaderboard/current                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: get_current_leaderboard()                         │
│  1. Check if snapshot exists                                │
│  2. Check if snapshot is outdated (>3 days)                 │
│  3. If outdated → Call generate_leaderboard_snapshot()      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: generate_leaderboard_snapshot()                   │
│                                                              │
│  Step 1: Calculate Date Window                               │
│    to_date = datetime.utcnow()        # Dec 13, 2:00 PM     │
│    from_date = to_date - 3 days       # Dec 10, 2:00 PM     │
│                                                              │
│  Step 2: Query Database                                     │
│    db.posts.find({                                           │
│      "created_at": {                                         │
│        "$gte": "2024-12-10T14:00:00",  # Dec 10             │
│        "$lte": "2024-12-13T14:00:00"   # Dec 13            │
│      }                                                       │
│    })                                                        │
│    → Returns all posts from Dec 10-13                       │
│                                                              │
│  Step 3: Calculate Scores                                   │
│    For each post:                                           │
│      - Quality Score (from DB)                              │
│      - Engagement Score = (likes / max_likes) * 100         │
│      - Post Count Score = (user_posts / max_posts) * 100    │
│      - Combined = 0.5×quality + 0.3×engagement + 0.2×posts  │
│                                                              │
│  Step 4: Sort & Filter                                      │
│    Sort by combined_score DESC                              │
│    Take top 10 posts                                        │
│                                                              │
│  Step 5: Save Snapshot                                      │
│    {                                                         │
│      "from_date": "2024-12-10T14:00:00",                    │
│      "to_date": "2024-12-13T14:00:00",                      │
│      "entries": [top 10 posts with scores]                   │
│    }                                                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND: Return Response                                    │
│  {                                                           │
│    "from_date": "2024-12-10T14:00:00",                      │
│    "to_date": "2024-12-13T14:00:00",                        │
│    "entries": [...]                                         │
│  }                                                           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: formatDate()                                      │
│                                                              │
│  formatDate("2024-12-10T14:00:00")                          │
│    → Parse ISO string                                        │
│    → Extract month: "Dec" (month 11)                        │
│    → Extract day: 10                                        │
│    → Return "Dec 10"                                        │
│                                                              │
│  formatDate("2024-12-13T14:00:00")                          │
│    → Return "Dec 13"                                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND: Display                                           │
│  "Dec 10 - Dec 13 (3 days)"                                 │
│  + Top 10 posts with scores                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 KEY POINTS

1. **3-Day Rolling Window:**
   - Always shows posts from "Today - 3 days" to "Today"
   - Updates automatically when snapshot becomes outdated

2. **Date Display:**
   - "Dec 10 - Dec 13" means posts from December 10 to December 13
   - Calculated dynamically based on current date
   - Uses UTC timezone to avoid timezone conversion issues

3. **Filtration Happens in Backend:**
   - MongoDB query filters posts by `created_at` date
   - Only posts within the 3-day window are analyzed
   - Frontend just displays the filtered results

4. **Scoring System:**
   - Quality: 50% weight
   - Engagement (Likes): 30% weight
   - Post Count: 20% weight
   - Combined score determines ranking

5. **Top 10 Only:**
   - After scoring, only top 10 posts are returned
   - Ranked by combined score (highest first)

---

## 🔍 DEBUGGING TIPS

If dates show incorrectly:

1. **Check Backend Logs:**
   ```python
   logger.info(f"🏆 Generating leaderboard for window: {from_date} to {to_date}")
   ```

2. **Check Frontend Console:**
   ```typescript
   console.log("✅ Leaderboard data loaded:", {
       from_date: fromDate,
       to_date: toDate,
   });
   ```

3. **Verify Date Format:**
   - Backend sends: ISO format `"2024-12-10T14:00:00"`
   - Frontend expects: ISO format with optional 'Z' suffix
   - Frontend uses UTC methods to parse correctly

---

## 📝 SUMMARY

**Why "Dec 10 - Dec 13" shows:**
- Backend calculates: Current date (Dec 13) - 3 days = Dec 10
- This creates a 3-day window: Dec 10 to Dec 13
- Frontend formats these dates as "Dec 10 - Dec 13"

**How filtration works:**
1. Backend queries MongoDB for posts between `from_date` and `to_date`
2. Calculates scores for each post in that window
3. Sorts by combined score and returns top 10
4. Frontend displays the results with formatted dates

The system is **dynamic** - the date range updates automatically every 3 days!

