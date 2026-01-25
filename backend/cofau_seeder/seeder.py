#!/usr/bin/env python3
"""
Cofau Restaurant Seeder Bot v2
------------------------------
Uses free Unsplash images + includes Google Maps links.

Usage:
    python3 seeder_v2.py

Requirements:
    pip install requests --break-system-packages
"""

import os
import sys
import json
import random
import time
import requests
from pathlib import Path
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================

# Cofau API settings
API_BASE_URL = "https://api.cofau.com"

# Bot account credentials
BOT_EMAIL = "ironman123@mail.com"
BOT_PASSWORD = "ironman12345"

# Restaurants to seed with map links and food search terms
RESTAURANTS = [
    {
        "name": "Karavalli",
        "area": "Residency Road/MG Road",
        "category": "South Indian/Seafood",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Karavalli+Restaurant+Bangalore",
        "food_terms": ["south indian food", "seafood curry"]
    },
    {
        "name": "Lotus Pavilion",
        "area": "Residency Road/MG Road",
        "category": "European/International",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Lotus+Pavilion+ITC+Windsor+Bangalore",
        "food_terms": ["european cuisine", "fine dining"]
    },
    {
        "name": "Jamavar",
        "area": "Old Airport Road/HAL",
        "category": "Indian",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Jamavar+The+Leela+Palace+Bangalore",
        "food_terms": ["indian curry", "biryani"]
    },
    {
        "name": "Ssaffron",
        "area": "Palace Road",
        "category": "Indian",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Ssaffron+Shangri-La+Bangalore",
        "food_terms": ["indian thali", "tandoori chicken"]
    },
    {
        "name": "Rim Naam",
        "area": "MG Road/The Oberoi",
        "category": "Thai",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Rim+Naam+The+Oberoi+Bangalore",
        "food_terms": ["thai food", "pad thai noodles"]
    },
    {
        "name": "Bombay Brasserie",
        "area": "Indiranagar",
        "category": "North Indian",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Bombay+Brasserie+Indiranagar+Bangalore",
        "food_terms": ["butter chicken", "north indian food"]
    },
    {
        "name": "Truffles",
        "area": "Koramangala",
        "category": "Cafe/American",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Truffles+Koramangala+Bangalore",
        "food_terms": ["burger", "american food"]
    },
    {
        "name": "The Reservoire",
        "area": "Koramangala",
        "category": "Bar & Casual Dining",
        "map_link": "https://www.google.com/maps/search/?api=1&query=The+Reservoire+Koramangala+Bangalore",
        "food_terms": ["bar food appetizers", "cocktail snacks"]
    },
    {
        "name": "Oota Bangalore",
        "area": "Whitefield",
        "category": "Karnataka Cuisine",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Oota+Bangalore+Whitefield",
        "food_terms": ["karnataka food", "dosa idli"]
    },
    {
        "name": "Time Traveller (Urban Herbivore)",
        "area": "Electronic City/Bommasandra",
        "category": "Buffet/Indian",
        "map_link": "https://www.google.com/maps/search/?api=1&query=Time+Traveller+Urban+Herbivore+Electronic+City+Bangalore",
        "food_terms": ["indian buffet", "vegetarian thali"]
    }
]

# Number of posts per restaurant
POSTS_PER_RESTAURANT = 2

# Review templates
REVIEW_TEMPLATES = [
    "Amazing food at {name}! The {category} dishes here are absolutely incredible. Must visit if you're in {area}.",
    "Had a fantastic dining experience at {name}. The ambiance and food quality are top-notch!",
    "One of the best {category} spots in Bangalore. {name} never disappoints!",
    "Highly recommend {name} in {area}. The flavors are authentic and the service is excellent.",
    "A hidden gem in {area}! {name} serves some of the finest {category} cuisine in the city.",
    "If you love {category}, {name} is the place to be. Every dish is a masterpiece!",
    "Just discovered {name} and I'm blown away! Perfect spot for {category} lovers.",
    "The food at {name} is absolutely divine. Can't wait to come back!",
    "{name} offers an exceptional {category} experience. Worth every penny!",
    "Visited {name} in {area} today. The food was outstanding - definitely coming back!",
]

# Image download settings
IMAGES_DIR = Path(__file__).parent / "images"
IMAGES_DIR.mkdir(exist_ok=True)

# ============================================
# LOGGING
# ============================================

def log(message, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


# ============================================
# FREE IMAGE SOURCES
# ============================================

class FreeImageFetcher:
    """Fetches free food images from Unsplash Source API (no API key needed)"""
    
    def __init__(self):
        self.used_images = set()
    
    def get_food_image_url(self, search_term):
        """Get a random food image URL from Unsplash Source"""
        random_seed = random.randint(1, 10000)
        clean_term = search_term.replace(" ", ",")
        url = f"https://source.unsplash.com/800x600/?{clean_term}&sig={random_seed}"
        return url
    
    def download_image(self, search_term, filename):
        """Download a food image"""
        try:
            url = self.get_food_image_url(search_term)
            log(f"Fetching image for: {search_term}")
            
            response = requests.get(url, timeout=30, allow_redirects=True)
            
            if response.status_code == 200:
                filepath = IMAGES_DIR / filename
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                # Verify file size (should be > 10KB for a real image)
                if os.path.getsize(filepath) > 10000:
                    log(f"✅ Downloaded: {filename} ({os.path.getsize(filepath)} bytes)")
                    return filepath
                else:
                    log(f"Image too small, retrying...", "WARN")
                    os.remove(filepath)
                    return None
            else:
                log(f"Failed to download: {response.status_code}", "ERROR")
                return None
                
        except Exception as e:
            log(f"Error downloading image: {e}", "ERROR")
            return None
    
    def get_images_for_restaurant(self, restaurant, count=2):
        """Get multiple images for a restaurant"""
        images = []
        food_terms = restaurant.get("food_terms", ["food"])
        
        for i in range(count):
            term = food_terms[i % len(food_terms)]
            
            safe_name = restaurant["name"].replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "")
            filename = f"{safe_name}_{i+1}_{int(time.time())}_{random.randint(1000,9999)}.jpg"
            
            filepath = self.download_image(term, filename)
            if filepath:
                images.append(filepath)
            
            time.sleep(1)
        
        return images


# ============================================
# COFAU API CLIENT
# ============================================

class CofauClient:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")
        self.token = None
        self.session = requests.Session()
    
    def login(self, email, password):
        """Login to Cofau and get access token"""
        log(f"Logging in as {email}...")
        
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            data={
                "username": email,
                "password": password
            }
        )
        
        if response.status_code != 200:
            log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
            return False
        
        data = response.json()
        self.token = data.get("access_token")
        
        if not self.token:
            log("No access token received", "ERROR")
            return False
        
        log("✅ Login successful!")
        return True
    
    def create_post(self, image_path, rating, review_text, location_name, category, map_link=None):
        """Create a new post on Cofau"""
        if not self.token:
            log("Not logged in!", "ERROR")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.token}"
        }
        
        data = {
            "rating": str(rating),
            "review_text": review_text,
            "location_name": location_name,
            "category": category,
        }
        
        if map_link:
            data["map_link"] = map_link
        
        try:
            with open(image_path, "rb") as f:
                files = {
                    "file": (os.path.basename(image_path), f, "image/jpeg")
                }
                
                response = self.session.post(
                    f"{self.base_url}/api/posts/create",
                    headers=headers,
                    data=data,
                    files=files,
                    timeout=60
                )
            
            if response.status_code in [200, 201]:
                result = response.json()
                log(f"✅ Post created! ID: {result.get('post_id', 'N/A')}")
                return True
            else:
                log(f"Failed to create post: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            log(f"Error creating post: {e}", "ERROR")
            return False


# ============================================
# MAIN SEEDER FUNCTION
# ============================================

def seed_restaurant(client, image_fetcher, restaurant):
    """Seed posts for a single restaurant"""
    name = restaurant["name"]
    area = restaurant["area"]
    category = restaurant["category"]
    map_link = restaurant.get("map_link")
    
    log(f"\n{'='*50}")
    log(f"Processing: {name} ({area})")
    log(f"Category: {category}")
    log(f"Map Link: {map_link}")
    log(f"{'='*50}")
    
    # Get images
    images = image_fetcher.get_images_for_restaurant(restaurant, count=POSTS_PER_RESTAURANT)
    
    if not images:
        log(f"No images found for {name}, skipping...", "WARN")
        return 0
    
    posts_created = 0
    
    for i, filepath in enumerate(images):
        # Generate review
        review_template = random.choice(REVIEW_TEMPLATES)
        review_text = review_template.format(
            name=name,
            area=area.split("/")[0],
            category=category.split("/")[0] if "/" in category else category
        )
        
        # Random rating between 7-10
        rating = random.randint(7, 10)
        
        # Location name
        location_name = f"{name}, {area}, Bangalore"
        
        log(f"Creating post {i+1}/{POSTS_PER_RESTAURANT}...")
        log(f"  Rating: {rating}/10")
        log(f"  Location: {location_name}")
        log(f"  Review: {review_text[:50]}...")
        
        # Create post with map link
        success = client.create_post(
            image_path=filepath,
            rating=rating,
            review_text=review_text,
            location_name=location_name,
            category=category.split("/")[0] if "/" in category else category,
            map_link=map_link  # ✅ Map link included!
        )
        
        if success:
            posts_created += 1
        
        # Clean up downloaded image
        try:
            os.remove(filepath)
            log(f"Cleaned up: {filepath.name}")
        except:
            pass
        
        # Delay between posts
        time.sleep(2)
    
    return posts_created


def main():
    """Main function"""
    log("="*60)
    log("🍽️  COFAU RESTAURANT SEEDER BOT v2")
    log("    With Map Links + Unsplash Images")
    log("="*60)
    
    # Initialize client
    client = CofauClient(API_BASE_URL)
    
    # Login
    if not client.login(BOT_EMAIL, BOT_PASSWORD):
        log("Failed to login, exiting...", "ERROR")
        sys.exit(1)
    
    # Initialize image fetcher
    image_fetcher = FreeImageFetcher()
    
    total_posts = 0
    successful_restaurants = 0
    
    for restaurant in RESTAURANTS:
        posts_created = seed_restaurant(client, image_fetcher, restaurant)
        total_posts += posts_created
        
        if posts_created > 0:
            successful_restaurants += 1
        
        log("Waiting 3 seconds before next restaurant...")
        time.sleep(3)
    
    log("\n" + "="*60)
    log("🎉 SEEDING COMPLETE!")
    log(f"   Restaurants processed: {successful_restaurants}/{len(RESTAURANTS)}")
    log(f"   Total posts created: {total_posts}")
    log("="*60)


if __name__ == "__main__":
    main()
