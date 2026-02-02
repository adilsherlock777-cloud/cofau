import google.generativeai as genai
import json
from typing import List, Dict, Any
from models.menu import MenuItem
import os
from PIL import Image
import io
import httpx

# Get API key from environment
GOOGLE_GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY")

# Log API key status
if not GOOGLE_GEMINI_API_KEY:
    print("⚠️ WARNING: GOOGLE_GEMINI_API_KEY not found in environment!")
else:
    print(f"✅ Google Gemini API Key loaded: {GOOGLE_GEMINI_API_KEY[:20]}...")

# Configure Gemini
genai.configure(api_key=GOOGLE_GEMINI_API_KEY)

class MenuExtractionService:
    """Service for extracting menu items from images using Google Gemini Flash Vision"""

    def __init__(self):
        # Use Gemini 1.5 Flash - Fast, cheap, and excellent for vision tasks
        self.model = genai.GenerativeModel('gemini-1.5-flash-latest')

    async def extract_menu_items(self, image_urls: List[str]) -> List[MenuItem]:
        """
        Extract menu items from multiple menu images

        Args:
            image_urls: List of URLs or file paths to menu images

        Returns:
            List of MenuItem objects with confidence scores
        """
        all_items = []

        for image_url in image_urls:
            try:
                print(f"📸 Processing image: {image_url}")
                items = await self._process_single_image(image_url)
                print(f"✅ Extracted {len(items)} items from image")
                all_items.extend(items)
            except Exception as e:
                print(f"❌ Error processing image {image_url}: {e}")
                import traceback
                traceback.print_exc()
                continue

        print(f"🎯 Total items extracted: {len(all_items)}")
        return all_items

    async def _process_single_image(self, image_url: str) -> List[MenuItem]:
        """Process a single menu image"""

        # Load the image
        image = await self._load_image(image_url)

        # Create the prompt for Gemini
        prompt = """You are a menu extraction expert. Analyze this menu image and extract ALL visible menu items.

For each item, extract:
1. **name**: The dish/item name (REQUIRED)
2. **price**: The price in ₹ (Indian Rupees). Extract only the number, no currency symbol.
3. **category**: The category (e.g., "Starters", "Main Course", "Desserts", "Beverages", etc.)
4. **description**: Any description or ingredients listed

**IMPORTANT RULES:**
- Extract EVERY item you can see, even if some information is missing
- If price is unclear or missing, set it to null
- If category is not explicitly mentioned, try to infer it from context or set to "Uncategorized"
- If description is not available, set it to null
- For confidence, use:
  - 1.0 = All fields clear and readable
  - 0.8 = Minor uncertainties (e.g., unclear currency, assumed category)
  - 0.6 = Moderate uncertainties (e.g., blurry price, unclear item name)
  - 0.4 = Major uncertainties (e.g., partially visible, very unclear)

Return ONLY a valid JSON array of objects with this exact structure:
[
  {
    "name": "Item Name",
    "price": 299.0,
    "category": "Main Course",
    "description": "Description here",
    "confidence": 0.9
  }
]

Do not include any explanatory text, markdown formatting, or code blocks - only the raw JSON array."""

        # Call Gemini Vision API
        try:
            response = self.model.generate_content([prompt, image])
            response_text = response.text

            # Parse JSON response
            items_data = self._parse_response(response_text)

            # Convert to MenuItem objects
            items = self._convert_to_menu_items(items_data)

            return items

        except Exception as e:
            print(f"Error calling Gemini API: {e}")
            raise

    async def _load_image(self, image_url: str) -> Image.Image:
        """
        Load image from URL or local file path
        Returns PIL Image object
        """
        try:
            # Check if it's a URL
            if image_url.startswith('http://') or image_url.startswith('https://'):
                # Download image from URL
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    image_data = response.content
                    image = Image.open(io.BytesIO(image_data))
            else:
                # Local file path
                image = Image.open(image_url)

            # Convert to RGB if necessary (Gemini prefers RGB)
            if image.mode != 'RGB':
                image = image.convert('RGB')

            return image

        except Exception as e:
            print(f"Error loading image {image_url}: {e}")
            raise

    def _parse_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse Gemini's JSON response, handling potential formatting issues"""
        try:
            # Clean the response text
            cleaned_text = response_text.strip()

            # Remove markdown code blocks if present
            if "```json" in cleaned_text:
                json_start = cleaned_text.find("```json") + 7
                json_end = cleaned_text.find("```", json_start)
                cleaned_text = cleaned_text[json_start:json_end].strip()
            elif "```" in cleaned_text:
                json_start = cleaned_text.find("```") + 3
                json_end = cleaned_text.find("```", json_start)
                cleaned_text = cleaned_text[json_start:json_end].strip()

            # Find JSON array
            start_idx = cleaned_text.find('[')
            end_idx = cleaned_text.rfind(']') + 1

            if start_idx != -1 and end_idx != 0:
                json_str = cleaned_text[start_idx:end_idx]
                return json.loads(json_str)
            else:
                # Try direct parse
                return json.loads(cleaned_text)

        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Response text: {response_text}")
            raise ValueError(f"Could not extract valid JSON from response: {str(e)}")

    def _convert_to_menu_items(self, items_data: List[Dict[str, Any]]) -> List[MenuItem]:
        """Convert raw JSON data to MenuItem objects with validation"""
        items = []

        for item_data in items_data:
            try:
                # Calculate if needs review based on confidence and missing fields
                confidence = item_data.get('confidence', 0.5)
                has_price = item_data.get('price') is not None
                has_category = item_data.get('category') is not None and item_data.get('category') != "Uncategorized"

                # Flag for review if:
                # - Confidence < 0.7
                # - Missing price
                # - No category or generic category
                needs_review = (
                    confidence < 0.7 or
                    not has_price or
                    not has_category
                )

                item = MenuItem(
                    name=item_data.get('name', 'Unknown Item'),
                    price=item_data.get('price'),
                    category=item_data.get('category'),
                    description=item_data.get('description'),
                    confidence=confidence,
                    needs_review=needs_review
                )
                items.append(item)
            except Exception as e:
                print(f"Error converting item {item_data}: {e}")
                continue

        return items

    async def batch_extract(self, image_batches: List[List[str]]) -> List[MenuItem]:
        """
        Process multiple batches of images
        Useful for restaurants with many menu pages
        """
        all_items = []

        for batch in image_batches:
            batch_items = await self.extract_menu_items(batch)
            all_items.extend(batch_items)

        return all_items


# Initialize service instance
menu_extraction_service = MenuExtractionService()
