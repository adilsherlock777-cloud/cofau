#!/usr/bin/env python3
"""
Debug script to check reviews and their restaurant associations
"""
import asyncio
import sys
from bson import ObjectId
from database import get_database

async def debug_reviews():
    """Check reviews in the database"""
    db = get_database()

    print("=" * 60)
    print("🔍 REVIEWS DEBUG SCRIPT")
    print("=" * 60)

    # Get all reviews
    all_reviews = await db.reviews.find().to_list(None)
    print(f"\n📊 Total reviews in database: {len(all_reviews)}")

    if len(all_reviews) == 0:
        print("\n⚠️  NO REVIEWS FOUND!")
        print("   This is why the Reviews/Complaints tab is empty.")
        print("   Users need to submit reviews after completing orders.")
        return

    # Get all restaurants
    all_restaurants = await db.restaurants.find().to_list(None)
    print(f"📊 Total restaurants in database: {len(all_restaurants)}")

    # Create a map of restaurant IDs
    restaurant_map = {}
    for r in all_restaurants:
        restaurant_map[str(r["_id"])] = r.get("restaurant_name", "Unknown")

    print("\n" + "=" * 60)
    print("📋 ALL REVIEWS:")
    print("=" * 60)

    for idx, review in enumerate(all_reviews, 1):
        review_id = str(review["_id"])
        order_id = review.get("order_id", "N/A")
        restaurant_id = review.get("restaurant_id", "N/A")
        customer_name = review.get("customer_name", "Anonymous")
        rating = review.get("rating", "N/A")
        is_complaint = review.get("is_complaint", False)
        review_text = review.get("review_text", "")[:50]

        restaurant_name = restaurant_map.get(restaurant_id, f"❌ NOT FOUND (ID: {restaurant_id})")

        print(f"\n{idx}. Review ID: {review_id}")
        print(f"   Order ID: {order_id}")
        print(f"   Restaurant ID: {restaurant_id}")
        print(f"   Restaurant Name: {restaurant_name}")
        print(f"   Customer: {customer_name}")
        print(f"   Rating: {rating}/5")
        print(f"   Is Complaint: {'Yes' if is_complaint else 'No'}")
        print(f"   Text: {review_text}...")

    # Group reviews by restaurant
    print("\n" + "=" * 60)
    print("📊 REVIEWS GROUPED BY RESTAURANT:")
    print("=" * 60)

    reviews_by_restaurant = {}
    for review in all_reviews:
        restaurant_id = review.get("restaurant_id", "unknown")
        if restaurant_id not in reviews_by_restaurant:
            reviews_by_restaurant[restaurant_id] = []
        reviews_by_restaurant[restaurant_id].append(review)

    for restaurant_id, reviews in reviews_by_restaurant.items():
        restaurant_name = restaurant_map.get(restaurant_id, f"Unknown (ID: {restaurant_id})")
        print(f"\n🏪 {restaurant_name}")
        print(f"   Restaurant ID: {restaurant_id}")
        print(f"   Number of reviews: {len(reviews)}")

    # Check for orphaned reviews (reviews with restaurant_id not in restaurants collection)
    print("\n" + "=" * 60)
    print("⚠️  ORPHANED REVIEWS (restaurant not found):")
    print("=" * 60)

    orphaned = False
    for review in all_reviews:
        restaurant_id = review.get("restaurant_id")
        if restaurant_id not in restaurant_map:
            orphaned = True
            print(f"\n❌ Review ID: {review['_id']}")
            print(f"   Restaurant ID: {restaurant_id} (NOT FOUND IN DATABASE)")
            print(f"   Order ID: {review.get('order_id')}")

    if not orphaned:
        print("\n✅ No orphaned reviews found. All reviews are properly linked.")

    print("\n" + "=" * 60)
    print("✅ Debug complete!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(debug_reviews())
    except KeyboardInterrupt:
        print("\n\n⚠️  Script interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
