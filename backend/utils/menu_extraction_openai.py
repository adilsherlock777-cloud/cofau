import json
from typing import List, Dict, Any
from models.menu import MenuItem
import os
from PIL import Image
import io
import httpx
import base64
from openai import OpenAI

# Get API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Log API key status
if not OPENAI_API_KEY:
    print("⚠️ WARNING: OPENAI_API_KEY not found in environment!")
else:
    print(f"✅ OpenAI API Key loaded: {OPENAI_API_KEY[:20]}...")


class MenuExtractionService:
    """Service for extracting menu items from images using OpenAI GPT-4o Vision"""

    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
        self.model = "gpt-4o"  # GPT-4o has vision capabilities

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

        # Load and encode the image
        image_data = await self._load_image_as_base64(image_url)

        # Create the prompt for OpenAI
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

        # Call OpenAI Vision API
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=4096
            )
            response_text = response.choices[0].message.content

            # Parse JSON response
            items_data = self._parse_response(response_text)

            # Convert to MenuItem objects
            items = self._convert_to_menu_items(items_data)

            return items

        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            raise

    async def _load_image_as_base64(self, image_url: str) -> str:
        """
        Load image from URL or local file path and convert to base64
        Returns base64 encoded string
        """
        try:
            # Check if it's a URL
            if image_url.startswith('http://') or image_url.startswith('https://'):
                # Download image from URL
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    image_data = response.content
            else:
                # Local file path
                with open(image_url, 'rb') as f:
                    image_data = f.read()

            # Convert to base64
            return base64.b64encode(image_data).decode('utf-8')

        except Exception as e:
            print(f"Error loading image {image_url}: {e}")
            raise

    def _parse_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse OpenAI's JSON response, handling potential formatting issues"""
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
