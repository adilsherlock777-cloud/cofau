import anthropic
import json
import base64
import httpx
from typing import List, Dict, Any
from models.menu import MenuItem
import os

# Get API key from environment
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

class MenuExtractionService:
    """Service for extracting menu items from images using Claude Vision API"""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.model = "claude-3-5-sonnet-20241022"  # Latest Claude model with vision

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
                items = await self._process_single_image(image_url)
                all_items.extend(items)
            except Exception as e:
                print(f"Error processing image {image_url}: {e}")
                continue

        return all_items

    async def _process_single_image(self, image_url: str) -> List[MenuItem]:
        """Process a single menu image"""

        # Prepare image for API
        image_content = await self._prepare_image(image_url)

        # Create the prompt for Claude
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

Do not include any explanatory text, only the JSON array."""

        # Call Claude Vision API
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": image_content,
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ],
                    }
                ],
            )

            # Extract text response
            response_text = message.content[0].text

            # Parse JSON response
            items_data = self._parse_response(response_text)

            # Convert to MenuItem objects
            items = self._convert_to_menu_items(items_data)

            return items

        except Exception as e:
            print(f"Error calling Claude API: {e}")
            raise

    async def _prepare_image(self, image_url: str) -> Dict[str, Any]:
        """
        Prepare image for Claude API
        Supports both URLs and local file paths
        """
        # Check if it's a local file or URL
        if image_url.startswith('http://') or image_url.startswith('https://'):
            # For URLs, we need to download and encode
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                response.raise_for_status()
                image_data = response.content

                # Determine media type from content-type header
                content_type = response.headers.get('content-type', 'image/jpeg')
                media_type = content_type if content_type.startswith('image/') else 'image/jpeg'

                # Encode to base64
                encoded_image = base64.standard_b64encode(image_data).decode('utf-8')

                return {
                    "type": "base64",
                    "media_type": media_type,
                    "data": encoded_image,
                }
        else:
            # Local file path
            with open(image_url, 'rb') as f:
                image_data = f.read()

                # Determine media type from file extension
                ext = image_url.lower().split('.')[-1]
                media_type_map = {
                    'jpg': 'image/jpeg',
                    'jpeg': 'image/jpeg',
                    'png': 'image/png',
                    'gif': 'image/gif',
                    'webp': 'image/webp'
                }
                media_type = media_type_map.get(ext, 'image/jpeg')

                # Encode to base64
                encoded_image = base64.standard_b64encode(image_data).decode('utf-8')

                return {
                    "type": "base64",
                    "media_type": media_type,
                    "data": encoded_image,
                }

    def _parse_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse Claude's JSON response, handling potential formatting issues"""
        try:
            # Try direct JSON parse first
            return json.loads(response_text)
        except json.JSONDecodeError:
            # If that fails, try to extract JSON from markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
                return json.loads(json_str)
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                json_str = response_text[json_start:json_end].strip()
                return json.loads(json_str)
            else:
                # Try to find JSON array in the response
                start_idx = response_text.find('[')
                end_idx = response_text.rfind(']') + 1
                if start_idx != -1 and end_idx != 0:
                    json_str = response_text[start_idx:end_idx]
                    return json.loads(json_str)
                else:
                    raise ValueError("Could not extract JSON from response")

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
