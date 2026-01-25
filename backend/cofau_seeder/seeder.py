#!/usr/bin/env python3
"""
Cofau Restaurant Seeder Bot
---------------------------
This bot seeds the Cofau app with food posts from popular Bangalore restaurants.

It:
1. Logs into Cofau as a designated account
2. Scrapes food photos from Google Maps for each restaurant
3. Uploads them as posts to Cofau

Usage:
    python seeder.py

Requirements:
    pip install requests beautifulsoup4 playwright
    playwright install chromium
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
API_BASE_URL = "https://api.cofau.com"  # Change to localhost:8000 for local testing

# Bot account credentials
BOT_EMAIL = "ironman123@mail.com"
BOT_PASSWORD = "ironman12345"

# Restaurants to seed (initial test list)
RESTAURANTS = [
    {"name": "Karavalli", "area": "Residency Road/MG Road", "category": "South Indian/Seafood"},
    {"name": "Lotus Pavilion", "area": "Residency Road/MG Road", "category": "European/International"},
    {"name": "Jamavar", "area": "Old Airport Road/HAL", "category": "Indian"},
    {"name": "Ssaffron", "area": "Palace Road", "category": "Indian"},
    {"name": "Rim Naam", "area": "MG Road/The Oberoi", "category": "Thai"},
    {"name": "Bombay Brasserie", "area": "Indiranagar", "category": "North Indian"},
    {"name": "Truffles", "area": "Koramangala", "category": "Cafe/American"},
    {"name": "The Reservoire", "area": "Koramangala", "category": "Bar & Casual Dining"},
    {"name": "Oota Bangalore", "area": "Whitefield", "category": "Karnataka Cuisine"},
    {"name": "Time Traveller (Urban Herbivore)", "area": "Electronic City/Bommasandra", "category": "Buffet/Indian"},
]

# Number of posts per restaurant
POSTS_PER_RESTAURANT = 2

# Review templates for variety
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
        
        # OAuth2PasswordRequestForm expects 'username' field (which is email in this case)
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            data={
                "username": email,  # OAuth2 uses 'username' field
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
        
        log("Login successful!")
        return True
    
    def create_post(self, image_path, rating, review_text, location_name, category, map_link=None):
        """Create a new post on Cofau"""
        if not self.token:
            log("Not logged in!", "ERROR")
            return False
        
        headers = {
            "Authorization": f"Bearer {self.token}"
        }
        
        # Prepare form data
        data = {
            "rating": str(rating),
            "review_text": review_text,
            "location_name": location_name,
            "category": category,
        }
        
        if map_link:
            data["map_link"] = map_link
        
        # Prepare file
        with open(image_path, "rb") as f:
            files = {
                "file": (os.path.basename(image_path), f, "image/jpeg")
            }
            
            response = self.session.post(
                f"{self.base_url}/api/posts/create",
                headers=headers,
                data=data,
                files=files
            )
        
        if response.status_code in [200, 201]:
            result = response.json()
            log(f"Post created successfully! ID: {result.get('post_id', 'N/A')}")
            return True
        else:
            log(f"Failed to create post: {response.status_code} - {response.text}", "ERROR")
            return False


# ============================================
# GOOGLE MAPS IMAGE SCRAPER
# ============================================

class GoogleMapsScraper:
    """Scrapes food images from Google Maps using Playwright"""
    
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None
    
    async def init_browser(self):
        """Initialize Playwright browser"""
        from playwright.async_api import async_playwright
        
        log("Initializing browser...")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        self.page = await self.context.new_page()
        log("Browser initialized!")
    
    async def close_browser(self):
        """Close browser"""
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        log("Browser closed")
    
    async def search_restaurant(self, name, area):
        """Search for a restaurant on Google Maps and get its URL"""
        search_query = f"{name} {area} Bangalore restaurant"
        search_url = f"https://www.google.com/maps/search/{requests.utils.quote(search_query)}"
        
        log(f"Searching: {search_query}")
        
        await self.page.goto(search_url, wait_until='networkidle', timeout=30000)
        await self.page.wait_for_timeout(3000)  # Wait for results to load
        
        # Get the current URL (might have redirected to the restaurant page)
        current_url = self.page.url
        
        # Try to click on the first result if we're on search results page
        try:
            first_result = await self.page.query_selector('a[href*="/maps/place/"]')
            if first_result:
                await first_result.click()
                await self.page.wait_for_timeout(3000)
                current_url = self.page.url
        except Exception as e:
            log(f"Could not click on result: {e}", "WARN")
        
        return current_url
    
    async def get_food_images(self, restaurant_name, area, count=2):
        """Get food images for a restaurant"""
        images = []
        
        try:
            # Search for the restaurant
            map_url = await self.search_restaurant(restaurant_name, area)
            log(f"Restaurant URL: {map_url}")
            
            # Wait for the page to load
            await self.page.wait_for_timeout(2000)
            
            # Try to click on Photos tab
            try:
                # Look for the photos button/tab
                photos_selectors = [
                    'button[aria-label*="Photo"]',
                    'button[data-tab-index="1"]',
                    '[role="tab"]:has-text("Photos")',
                    'button:has-text("Photos")',
                    '.section-hero-header-image-container',
                ]
                
                for selector in photos_selectors:
                    try:
                        photos_btn = await self.page.query_selector(selector)
                        if photos_btn:
                            await photos_btn.click()
                            await self.page.wait_for_timeout(3000)
                            break
                    except:
                        continue
                
            except Exception as e:
                log(f"Could not click photos tab: {e}", "WARN")
            
            # Try to find "Food" category if available
            try:
                food_selectors = [
                    'button:has-text("Food")',
                    '[aria-label*="Food"]',
                    'button:has-text("food")',
                ]
                
                for selector in food_selectors:
                    try:
                        food_btn = await self.page.query_selector(selector)
                        if food_btn:
                            await food_btn.click()
                            await self.page.wait_for_timeout(2000)
                            break
                    except:
                        continue
                        
            except Exception as e:
                log(f"No food category found: {e}", "WARN")
            
            # Collect image URLs
            image_elements = await self.page.query_selector_all('img[src*="googleusercontent"]')
            
            for i, img in enumerate(image_elements[:count * 3]):  # Get extra in case some fail
                try:
                    src = await img.get_attribute('src')
                    if src and 'googleusercontent' in src:
                        # Convert to higher resolution
                        # Replace size parameters for better quality
                        high_res_src = src.split('=')[0] + '=s1200-k-no'
                        images.append(high_res_src)
                        
                        if len(images) >= count:
                            break
                except Exception as e:
                    log(f"Error getting image src: {e}", "WARN")
                    continue
            
            # If we didn't get enough images from the photos section, try the main images
            if len(images) < count:
                main_images = await self.page.query_selector_all('img[src*="lh5.googleusercontent"], img[src*="lh3.googleusercontent"]')
                for img in main_images:
                    try:
                        src = await img.get_attribute('src')
                        if src and src not in images:
                            high_res_src = src.split('=')[0] + '=s1200-k-no'
                            images.append(high_res_src)
                            if len(images) >= count:
                                break
                    except:
                        continue
            
            log(f"Found {len(images)} images for {restaurant_name}")
            return images[:count], map_url
            
        except Exception as e:
            log(f"Error getting images for {restaurant_name}: {e}", "ERROR")
            return [], None
    
    async def download_image(self, url, filename):
        """Download an image from URL"""
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                filepath = IMAGES_DIR / filename
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                log(f"Downloaded: {filename}")
                return filepath
            else:
                log(f"Failed to download {url}: {response.status_code}", "ERROR")
                return None
        except Exception as e:
            log(f"Error downloading {url}: {e}", "ERROR")
            return None


# ============================================
# MAIN SEEDER FUNCTION
# ============================================

async def seed_restaurant(client, scraper, restaurant):
    """Seed posts for a single restaurant"""
    name = restaurant["name"]
    area = restaurant["area"]
    category = restaurant["category"]
    
    log(f"\n{'='*50}")
    log(f"Processing: {name} ({area})")
    log(f"{'='*50}")
    
    # Get images from Google Maps
    images, map_url = await scraper.get_food_images(name, area, count=POSTS_PER_RESTAURANT)
    
    if not images:
        log(f"No images found for {name}, skipping...", "WARN")
        return 0
    
    posts_created = 0
    
    for i, image_url in enumerate(images):
        # Download image
        safe_name = name.replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "")
        filename = f"{safe_name}_{i+1}_{int(time.time())}.jpg"
        filepath = await scraper.download_image(image_url, filename)
        
        if not filepath:
            continue
        
        # Generate review
        review_template = random.choice(REVIEW_TEMPLATES)
        review_text = review_template.format(
            name=name,
            area=area.split("/")[0],  # Use first part of area
            category=category.split("/")[0]  # Use first part of category
        )
        
        # Random rating between 7-10
        rating = random.randint(7, 10)
        
        # Create post
        location_name = f"{name}, {area}, Bangalore"
        
        success = client.create_post(
            image_path=filepath,
            rating=rating,
            review_text=review_text,
            location_name=location_name,
            category=category.split("/")[0],  # Use first category
            map_link=map_url
        )
        
        if success:
            posts_created += 1
        
        # Clean up downloaded image
        try:
            os.remove(filepath)
        except:
            pass
        
        # Small delay between posts
        time.sleep(2)
    
    return posts_created


async def main():
    """Main function to run the seeder"""
    log("="*60)
    log("COFAU RESTAURANT SEEDER BOT")
    log("="*60)
    
    # Initialize Cofau client
    client = CofauClient(API_BASE_URL)
    
    # Login
    if not client.login(BOT_EMAIL, BOT_PASSWORD):
        log("Failed to login, exiting...", "ERROR")
        sys.exit(1)
    
    # Initialize scraper
    scraper = GoogleMapsScraper()
    await scraper.init_browser()
    
    total_posts = 0
    successful_restaurants = 0
    
    try:
        for restaurant in RESTAURANTS:
            posts_created = await seed_restaurant(client, scraper, restaurant)
            total_posts += posts_created
            
            if posts_created > 0:
                successful_restaurants += 1
            
            # Delay between restaurants
            log("Waiting 5 seconds before next restaurant...")
            time.sleep(5)
    
    finally:
        await scraper.close_browser()
    
    log("\n" + "="*60)
    log("SEEDING COMPLETE!")
    log(f"Restaurants processed: {successful_restaurants}/{len(RESTAURANTS)}")
    log(f"Total posts created: {total_posts}")
    log("="*60)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
