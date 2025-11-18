# API Response Samples

## 1️⃣ `/api/feed` Response

**Endpoint:** `GET https://backend.cofau.com/api/feed`

**Sample Post JSON Block:**

```json
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
```

**Full Response (Array of Posts):**

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
  },
  {
    "id": "78901bcdefg2345678901234",
    "user_id": "23456bcdefg7890123456789",
    "username": "Jane Smith",
    "user_profile_picture": "/api/static/uploads/profile_pictures/profile_23456_20241112_150000.png",
    "user_badge": "influencer",
    "user_level": 10,
    "user_title": "Influencer",
    "media_url": "/api/static/uploads/posts/78901bcdefg2345678901234_restaurant.jpg",
    "image_url": "/api/static/uploads/posts/78901bcdefg2345678901234_restaurant.jpg",
    "media_type": "image",
    "rating": 9,
    "review_text": "Best Italian food in town! The pasta was incredible.",
    "map_link": "https://maps.google.com/?q=Italian+Restaurant",
    "likes_count": 128,
    "comments_count": 23,
    "is_liked_by_user": true,
    "is_liked": true,
    "created_at": "2024-11-12T14:20:00.000Z"
  }
]
```

---

## 2️⃣ `/api/posts/{postId}/comments` Response

**Note:** The actual endpoint is `/api/posts/{post_id}/comments`, not `/api/comments/{postId}`

**Endpoint:** `GET https://backend.cofau.com/api/posts/67890abcdef1234567890123/comments`

**Sample Comment JSON Block:**

```json
{
  "id": "abc123def456789012345678",
  "post_id": "67890abcdef1234567890123",
  "user_id": "34567cdefgh8901234567890",
  "username": "Sarah Johnson",
  "profile_pic": "/api/static/uploads/profile_pictures/profile_34567_20241110_120000.png",
  "comment_text": "I totally agree! This place is amazing. The coffee is definitely worth the visit!",
  "created_at": "2024-11-13T11:15:00.000Z"
}
```

**Full Response (Array of Comments):**

```json
[
  {
    "id": "abc123def456789012345678",
    "post_id": "67890abcdef1234567890123",
    "user_id": "34567cdefgh8901234567890",
    "username": "Sarah Johnson",
    "profile_pic": "/api/static/uploads/profile_pictures/profile_34567_20241110_120000.png",
    "comment_text": "I totally agree! This place is amazing. The coffee is definitely worth the visit!",
    "created_at": "2024-11-13T11:15:00.000Z"
  },
  {
    "id": "bcd234efg567890123456789",
    "post_id": "67890abcdef1234567890123",
    "user_id": "45678defghi9012345678901",
    "username": "Mike Wilson",
    "profile_pic": null,
    "comment_text": "How's the WiFi there? Need a good spot to work.",
    "created_at": "2024-11-13T10:45:00.000Z"
  },
  {
    "id": "cde345fgh678901234567890",
    "post_id": "67890abcdef1234567890123",
    "user_id": "56789efghij0123456789012",
    "username": "Emily Davis",
    "profile_pic": "/api/static/uploads/profile_pictures/profile_56789_20241108_090000.png",
    "comment_text": "The pastries are also incredible! Try the croissant next time.",
    "created_at": "2024-11-13T09:30:00.000Z"
  }
]
```

---

## 3️⃣ `/api/auth/me` Response

**Endpoint:** `GET https://backend.cofau.com/api/auth/me`

**Headers Required:**
```
Authorization: Bearer <your_access_token>
```

**Sample Response:**

```json
{
  "id": "12345abcdef6789012345678",
  "full_name": "John Doe",
  "email": "john.doe@example.com",
  "profile_picture": "/api/static/uploads/profile_pictures/profile_12345_20241113_160517.png",
  "bio": "Coffee enthusiast and food lover. Always exploring new places!",
  "points": 3250,
  "level": 5,
  "currentPoints": 750,
  "requiredPoints": 1250,
  "title": "Top Reviewer",
  "badge": "top_reviewer",
  "followers_count": 156,
  "following_count": 89,
  "created_at": "2024-01-15T08:00:00.000Z"
}
```

---

## Field Descriptions

### Post Fields:
- `id`: Unique post identifier (MongoDB ObjectId as string)
- `user_id`: ID of the user who created the post
- `username`: Display name of the post creator
- `user_profile_picture`: URL path to user's profile picture
- `user_badge`: User's badge type ("reviewer", "top_reviewer", "influencer", or null)
- `user_level`: User's current level (1-12)
- `user_title`: User's title based on level ("Reviewer", "Top Reviewer", "Influencer")
- `media_url`: URL path to the post media (image/video)
- `image_url`: Alias for media_url (for compatibility)
- `media_type`: Type of media ("image" or "video")
- `rating`: Rating score (typically 1-10)
- `review_text`: Text content of the review
- `map_link`: Google Maps link to the location (optional)
- `likes_count`: Number of likes on the post
- `comments_count`: Number of comments on the post
- `is_liked_by_user`: Boolean indicating if current user liked the post
- `is_liked`: Alias for is_liked_by_user (for compatibility)
- `created_at`: ISO 8601 timestamp of when the post was created

### Comment Fields:
- `id`: Unique comment identifier (MongoDB ObjectId as string)
- `post_id`: ID of the post this comment belongs to
- `user_id`: ID of the user who made the comment
- `username`: Display name of the commenter
- `profile_pic`: URL path to commenter's profile picture (can be null)
- `comment_text`: Text content of the comment
- `created_at`: ISO 8601 timestamp of when the comment was created

### User (Auth Me) Fields:
- `id`: Unique user identifier (MongoDB ObjectId as string)
- `full_name`: User's full name
- `email`: User's email address
- `profile_picture`: URL path to user's profile picture (can be null)
- `bio`: User's bio/description (can be null)
- `points`: Total accumulated points
- `level`: Current user level (1-12)
- `currentPoints`: Points earned in current level
- `requiredPoints`: Points needed to reach next level
- `title`: User's title based on level
- `badge`: Badge type (null, "reviewer", "top_reviewer", "influencer")
- `followers_count`: Number of followers
- `following_count`: Number of users being followed
- `created_at`: ISO 8601 timestamp of when the account was created

