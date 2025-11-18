# Exact API Responses

This document contains the exact response structures for the three requested endpoints.

## 1️⃣ `/api/feed`

**Endpoint:** `GET https://backend.cofau.com/api/feed`

**Authentication Required:** ✅ Yes (Bearer token)

### Error Response (401 - Not Authenticated):

```json
{
  "detail": "Not authenticated"
}
```

### Success Response (200):

Returns an **array of post objects**. Each post has the following structure:

```json
[
  {
    "id": "67890abcdef1234567890123",
    "user_id": "12345abcdef6789012345678",
    "username": "John Doe",
    "user_profile_picture": "/api/static/uploads/profile_pictures/profile_12345_20241113_160517.png",
    "user_badge": "reviewer",
    "user_level": 5,
    "user_title": "Top Reviewer",
    "media_url": "/api/static/uploads/posts/67890abcdef1234567890123_coffee_shop.jpg",
    "image_url": "/api/static/uploads/posts/67890abcdef1234567890123_coffee_shop.jpg",
    "media_type": "image",
    "rating": 8,
    "review_text": "Amazing coffee and great atmosphere! The latte was perfect and the staff was very friendly.",
    "map_link": "https://maps.google.com/?q=Coffee+Shop+Location",
    "likes_count": 42,
    "comments_count": 7,
    "is_liked_by_user": false,
    "is_liked": false,
    "created_at": "2024-11-13T10:30:00.000Z"
  }
]
```

**Query Parameters:**

- `skip` (optional, default: 0): Number of posts to skip
- `limit` (optional, default: 20): Maximum number of posts to return

**Response Fields:**

- `id`: Post ID (string, MongoDB ObjectId)
- `user_id`: User ID who created the post (string)
- `username`: Display name of the post creator (string)
- `user_profile_picture`: URL path to user's profile picture (string or null)
- `user_badge`: User's badge type - "reviewer", "top_reviewer", "influencer", or null
- `user_level`: User's current level (number, 1-12)
- `user_title`: User's title based on level (string)
- `media_url`: URL path to the post media (string)
- `image_url`: Alias for media_url (string)
- `media_type`: Type of media - "image" or "video" (string)
- `rating`: Rating score (number, typically 1-10)
- `review_text`: Text content of the review (string)
- `map_link`: Google Maps link to the location (string or null)
- `likes_count`: Number of likes on the post (number, always >= 0)
- `comments_count`: Number of comments on the post (number, always >= 0)
- `is_liked_by_user`: Boolean indicating if current user liked the post
- `is_liked`: Alias for is_liked_by_user (boolean)
- `created_at`: ISO 8601 timestamp (string)

---

## 2️⃣ `/api/stories/feed`

**Endpoint:** `GET https://backend.cofau.com/api/stories/feed`

**Note:** The endpoint is `/api/stories/feed` (plural "stories"), not `/api/story/feed`

**Authentication Required:** ✅ Yes (Bearer token)

### Error Response (401 - Not Authenticated):

```json
{
  "detail": "Not authenticated"
}
```

### Success Response (200):

Returns an **array of user story groups**. Each group contains a user object and their stories:

```json
[
  {
    "user": {
      "id": "12345abcdef6789012345678",
      "username": "John Doe",
      "full_name": "John Doe",
      "profile_picture": "/api/static/uploads/profile_pictures/profile_12345_20241113_160517.png",
      "level": 5
    },
    "stories": [
      {
        "id": "story123456789abcdef",
        "media_url": "/api/static/stories/story_12345_abc123.jpg",
        "media_type": "image",
        "created_at": "2024-11-13T10:30:00.000000",
        "expires_at": "2024-11-14T10:30:00.000000"
      },
      {
        "id": "story987654321fedcba",
        "media_url": "/api/static/stories/story_12345_def456.mp4",
        "media_type": "video",
        "created_at": "2024-11-13T11:00:00.000000",
        "expires_at": "2024-11-14T11:00:00.000000"
      }
    ]
  }
]
```

**Response Structure:**

- Returns stories from:
  - Users the current user follows
  - The current user's own stories
- Stories are grouped by user
- Only non-expired stories are returned (expires 24 hours after creation)
- Sorted: current user first, then by most recent story

**Response Fields:**

- `user`: User object containing:
  - `id`: User ID (string)
  - `username`: Username (string, falls back to full_name)
  - `full_name`: User's full name (string)
  - `profile_picture`: URL path to profile picture (string or null)
  - `level`: User's level (number)
- `stories`: Array of story objects, each containing:
  - `id`: Story ID (string)
  - `media_url`: URL path to story media (string)
  - `media_type`: Type of media - "image" or "video" (string)
  - `created_at`: ISO 8601 timestamp when story was created (string)
  - `expires_at`: ISO 8601 timestamp when story expires (string, 24 hours after creation)

---

## 3️⃣ `/api/users/{id}`

**Endpoint:** `GET https://backend.cofau.com/api/users/{user_id}`

**Authentication Required:** ❌ No (public endpoint)

**Path Parameter:**

- `{user_id}`: The MongoDB ObjectId of the user (24 character hex string)

### Error Response (404 - User Not Found):

```json
{
  "detail": "User not found"
}
```

### Success Response (200):

Returns a **single user profile object**:

```json
{
  "id": "12345abcdef6789012345678",
  "full_name": "John Doe",
  "email": "john.doe@example.com",
  "profile_picture": "/api/static/uploads/profile_pictures/profile_12345_20241113_160517.png",
  "bio": "Coffee enthusiast and food lover. Always exploring new places!",
  "points": 3250,
  "level": 5,
  "badge": "top_reviewer",
  "followers_count": 156,
  "following_count": 89,
  "created_at": "2024-01-15T08:00:00.000Z"
}
```

**Response Fields:**

- `id`: User ID (string, MongoDB ObjectId)
- `full_name`: User's full name (string)
- `email`: User's email address (string)
- `profile_picture`: URL path to profile picture (string or null)
- `bio`: User's bio/description (string or null)
- `points`: Total accumulated points (number)
- `level`: Current user level (number, 1-12)
- `badge`: Badge type - null, "reviewer", "top_reviewer", or "influencer" (string or null)
- `followers_count`: Number of followers (number)
- `following_count`: Number of users being followed (number)
- `created_at`: ISO 8601 timestamp when account was created (string)

---

## Summary

| Endpoint            | Auth Required | Response Type              | Status Codes |
| ------------------- | ------------- | -------------------------- | ------------ |
| `/api/feed`         | ✅ Yes        | Array of posts             | 200, 401     |
| `/api/stories/feed` | ✅ Yes        | Array of user story groups | 200, 401     |
| `/api/users/{id}`   | ❌ No         | Single user object         | 200, 404     |

---

## Actual Error Responses Received

When testing without authentication, the following responses were received:

### `/api/feed` (401):

```json
{
  "detail": "Not authenticated"
}
```

### `/api/stories/feed` (401):

```json
{
  "detail": "Not authenticated"
}
```

### `/api/users/{id}` (404):

```json
{
  "detail": "User not found"
}
```

---

## Notes

1. **Authentication**: The `/api/feed` and `/api/stories/feed` endpoints require a valid JWT token in the Authorization header:

   ```
   Authorization: Bearer <your_token>
   ```

2. **User ID Format**: User IDs are MongoDB ObjectIds (24 character hexadecimal strings)

3. **URL Paths**: Media URLs are relative paths that need to be prepended with the backend URL (e.g., `https://backend.cofau.com`)

4. **Story Expiration**: Stories expire 24 hours after creation and are automatically filtered out

5. **Pagination**: The `/api/feed` endpoint supports `skip` and `limit` query parameters for pagination
