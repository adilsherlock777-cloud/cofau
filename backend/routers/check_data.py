from fastapi import APIRouter
from database import get_database
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/debug", tags=["debug"])

@router.get("/check-posts")
async def check_posts():
    """Check posts in database for debugging"""
    db = get_database()
    
    # Count all posts
    total_posts = await db.posts.count_documents({})
    image_posts = await db.posts.count_documents({"media_type": "image"})
    video_posts = await db.posts.count_documents({"media_type": "video"})
    
    # Get all posts
    all_posts = await db.posts.find({}).sort("created_at", -1).to_list(100)
    
    posts_info = []
    for post in all_posts:
        posts_info.append({
            "created_at": post.get("created_at"),
            "media_type": post.get("media_type"),
            "rating": post.get("rating"),
            "likes_count": post.get("likes_count", 0),
            "id": str(post.get("_id"))
        })
    
    # Check recent posts
    from_date = datetime.utcnow() - timedelta(days=3)
    recent_count = await db.posts.count_documents({
        "created_at": {"$gte": from_date.isoformat()}
    })
    
    recent_images = await db.posts.count_documents({
        "created_at": {"$gte": from_date.isoformat()},
        "media_type": "image"
    })
    
    # Delete old snapshots
    deleted = await db.leaderboard_snapshots.delete_many({})
    
    return {
        "total_posts": total_posts,
        "image_posts": image_posts,
        "video_posts": video_posts,
        "recent_posts_3days": recent_count,
        "recent_images_3days": recent_images,
        "deleted_snapshots": deleted.deleted_count,
        "all_posts": posts_info
    }
