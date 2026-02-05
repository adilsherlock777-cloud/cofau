#!/usr/bin/env python3
"""
Check if a restaurant exists in the database
"""
import asyncio
from database import get_database

async def check_restaurant(email: str):
    """Check if restaurant exists"""
    db = get_database()

    # Check in restaurants collection
    restaurant = await db.restaurants.find_one({"email": email})

    if restaurant:
        print(f"✅ Restaurant found in database:")
        print(f"   ID: {restaurant.get('_id')}")
        print(f"   Name: {restaurant.get('restaurant_name')}")
        print(f"   Email: {restaurant.get('email')}")
        print(f"   Account Type: {restaurant.get('account_type', 'restaurant')}")
        print(f"   Created: {restaurant.get('created_at')}")
        return True
    else:
        print(f"❌ Restaurant NOT found in database with email: {email}")

        # List all restaurants
        all_restaurants = await db.restaurants.find().to_list(None)
        print(f"\n📋 All restaurants in database ({len(all_restaurants)} total):")
        for idx, r in enumerate(all_restaurants, 1):
            print(f"   {idx}. {r.get('restaurant_name')} - {r.get('email')}")

        return False

if __name__ == "__main__":
    # Check for the restaurant from the logs
    email = "halli123@mail.com"

    print(f"🔍 Checking for restaurant: {email}\n")

    asyncio.run(check_restaurant(email))
