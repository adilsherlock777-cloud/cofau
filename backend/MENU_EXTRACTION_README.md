# AI-Powered Menu Extraction System

This system allows restaurants to upload photos of their physical menus and automatically extract menu items using **Google Gemini Flash Vision API**. The system identifies items, prices, categories, and descriptions with confidence scoring.

## Features

✅ **AI-Powered Extraction**: Uses Google Gemini Flash Vision API to extract menu items from images
✅ **Confidence Scoring**: Flags items that need manual review
✅ **Review & Correction**: Restaurants can correct any extraction errors
✅ **Batch Processing**: Upload multiple menu pages at once
✅ **Public Menu API**: Share your menu with customers
✅ **Category Organization**: Automatically categorizes menu items

## Architecture

```
1. Restaurant uploads menu photos
         ↓
2. Send to Google Gemini Flash Vision API
         ↓
3. AI extracts: name, price, category, description
         ↓
4. Parse JSON response with confidence scores
         ↓
5. Flag low-confidence items (missing price, unclear name)
         ↓
6. Restaurant reviews & corrects on frontend
         ↓
7. Publish approved menu items
```

## Setup Instructions

### 1. Install Dependencies

The required dependencies are already in `requirements.txt`:
```bash
google-generativeai==0.8.3
httpx
Pillow
```

Install them:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Get Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key" (or use existing project)
4. Copy the API key
5. Add to your `.env` file:

```bash
# .env
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

**Free Tier Benefits:**
- 1,500 requests per day FREE
- 15 requests per minute rate limit
- No credit card required!

### 3. Create Menu Upload Directory

The directory is created automatically, but you can create it manually:
```bash
mkdir -p static/menu_uploads
```

### 4. Restart Server

```bash
pm2 restart cofau-backend
# or if running directly:
uvicorn server:app --reload
```

## API Endpoints

### 🔒 Restaurant-Only Endpoints (Authentication Required)

#### 1. Upload Menu Images
```http
POST /api/restaurant/menu/upload
Authorization: Bearer {restaurant_token}
Content-Type: multipart/form-data

files: [menu_image1.jpg, menu_image2.jpg, ...]
```

**Response:**
```json
{
  "items": [
    {
      "name": "Butter Chicken",
      "price": 299.0,
      "category": "Main Course",
      "description": "Creamy tomato gravy with tender chicken",
      "confidence": 0.95,
      "needs_review": false
    },
    {
      "name": "Paneer Tikka",
      "price": null,
      "category": "Starters",
      "description": null,
      "confidence": 0.6,
      "needs_review": true
    }
  ],
  "total_items": 2,
  "needs_review_count": 1,
  "extraction_id": "507f1f77bcf86cd799439011"
}
```

#### 2. Get Pending Items for Review
```http
GET /api/restaurant/menu/pending
Authorization: Bearer {restaurant_token}

# Optional query param:
?extraction_id=507f1f77bcf86cd799439011
```

#### 3. Update/Correct Menu Item
```http
PUT /api/restaurant/menu/items/{item_id}
Authorization: Bearer {restaurant_token}
Content-Type: application/json

{
  "name": "Paneer Tikka",
  "price": 249.0,
  "category": "Starters",
  "description": "Grilled cottage cheese with spices",
  "needs_review": false
}
```

#### 4. Delete Menu Item
```http
DELETE /api/restaurant/menu/items/{item_id}
Authorization: Bearer {restaurant_token}
```

#### 5. Publish Selected Items
```http
POST /api/restaurant/menu/publish
Authorization: Bearer {restaurant_token}
Content-Type: application/json

{
  "item_ids": ["507f...", "507f...", ...]
}
```

#### 6. Publish All Pending Items
```http
POST /api/restaurant/menu/publish-all
Authorization: Bearer {restaurant_token}
```

#### 7. Get Menu Statistics
```http
GET /api/restaurant/menu/stats
Authorization: Bearer {restaurant_token}
```

**Response:**
```json
{
  "total_items": 45,
  "pending_items": 5,
  "approved_items": 40,
  "needs_review": 3,
  "categories": [
    {"name": "Main Course", "count": 15},
    {"name": "Starters", "count": 10},
    {"name": "Desserts", "count": 8},
    {"name": "Beverages", "count": 7}
  ]
}
```

### 🌍 Public Endpoints (No Authentication)

#### Get Restaurant Menu (Public)
```http
GET /api/restaurant/menu/{restaurant_id}/public
```

**Response:**
```json
{
  "restaurant_id": "507f1f77bcf86cd799439011",
  "restaurant_name": "Spice Junction",
  "items": [
    {
      "id": "507f...",
      "name": "Butter Chicken",
      "price": 299.0,
      "category": "Main Course",
      "description": "Creamy tomato gravy",
      "confidence": 0.95,
      "status": "approved"
    }
  ],
  "total_items": 40,
  "categories": ["Main Course", "Starters", "Desserts"],
  "last_updated": "2024-01-15T10:30:00"
}
```

## Confidence Scoring & Review Logic

Items are automatically flagged for review (`needs_review: true`) when:

1. **Confidence < 0.7** - AI is uncertain about extraction
2. **Missing Price** - Price could not be identified
3. **No Category** - Category is unclear or "Uncategorized"

### Confidence Levels:
- **1.0** - All fields clear and readable
- **0.8** - Minor uncertainties (e.g., unclear currency)
- **0.6** - Moderate uncertainties (e.g., blurry price)
- **0.4** - Major uncertainties (e.g., partially visible)

## Database Schema

### Collection: `menu_items`

```javascript
{
  _id: ObjectId,
  restaurant_id: String,
  name: String,
  price: Float (nullable),
  category: String (nullable),
  description: String (nullable),
  confidence: Float (0-1),
  needs_review: Boolean,
  status: String, // "pending" | "approved" | "rejected"
  image_url: String (nullable),
  extraction_id: String,
  created_at: DateTime,
  updated_at: DateTime
}
```

## Testing the System

### Using cURL

1. **Upload Menu Images:**
```bash
curl -X POST "http://localhost:8000/api/restaurant/menu/upload" \
  -H "Authorization: Bearer YOUR_RESTAURANT_TOKEN" \
  -F "files=@menu1.jpg" \
  -F "files=@menu2.jpg"
```

2. **Get Pending Items:**
```bash
curl -X GET "http://localhost:8000/api/restaurant/menu/pending" \
  -H "Authorization: Bearer YOUR_RESTAURANT_TOKEN"
```

3. **Update an Item:**
```bash
curl -X PUT "http://localhost:8000/api/restaurant/menu/items/ITEM_ID" \
  -H "Authorization: Bearer YOUR_RESTAURANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paneer Tikka",
    "price": 249.0,
    "needs_review": false
  }'
```

4. **Publish All:**
```bash
curl -X POST "http://localhost:8000/api/restaurant/menu/publish-all" \
  -H "Authorization: Bearer YOUR_RESTAURANT_TOKEN"
```

5. **Get Public Menu:**
```bash
curl -X GET "http://localhost:8000/api/restaurant/menu/RESTAURANT_ID/public"
```

### Using Postman/Insomnia

Import these endpoints into your API client:
- Base URL: `http://localhost:8000` (or your production URL)
- Set Authorization header for restaurant endpoints
- Use form-data for file uploads

## Frontend Integration

### Step 1: Upload Menu (in feed.tsx or profile.tsx)

```typescript
const uploadMenuImages = async (images: File[]) => {
  const formData = new FormData();
  images.forEach(img => formData.append('files', img));

  const response = await axios.post(
    `${BACKEND_URL}/api/restaurant/menu/upload`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  );

  return response.data; // { items, needs_review_count, extraction_id }
};
```

### Step 2: Review Screen Component

Create a new component `MenuReviewScreen.tsx`:

```typescript
const MenuReviewScreen = ({ extractionId }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const fetchPendingItems = async () => {
    const response = await axios.get(
      `${BACKEND_URL}/api/restaurant/menu/pending?extraction_id=${extractionId}`,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    setItems(response.data);
  };

  const updateItem = async (itemId, updates) => {
    await axios.put(
      `${BACKEND_URL}/api/restaurant/menu/items/${itemId}`,
      updates,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    fetchPendingItems();
  };

  const publishAll = async () => {
    await axios.post(
      `${BACKEND_URL}/api/restaurant/menu/publish-all`,
      {},
      { headers: { Authorization: `Bearer ${token}` }}
    );
    Alert.alert('Success', 'Menu published!');
  };

  return (
    <View>
      {items.map(item => (
        <MenuItemCard
          key={item.id}
          item={item}
          onUpdate={(updates) => updateItem(item.id, updates)}
          needsReview={item.needs_review}
        />
      ))}
      <Button title="Publish All" onPress={publishAll} />
    </View>
  );
};
```

### Step 3: Display Public Menu (for any user)

```typescript
const RestaurantMenu = ({ restaurantId }) => {
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    const response = await axios.get(
      `${BACKEND_URL}/api/restaurant/menu/${restaurantId}/public`
    );
    setMenu(response.data);
  };

  return (
    <ScrollView>
      <Text>{menu?.restaurant_name}</Text>
      {menu?.categories.map(category => (
        <View key={category}>
          <Text>{category}</Text>
          {menu.items
            .filter(item => item.category === category)
            .map(item => (
              <View key={item.id}>
                <Text>{item.name}</Text>
                <Text>₹{item.price}</Text>
                <Text>{item.description}</Text>
              </View>
            ))}
        </View>
      ))}
    </ScrollView>
  );
};
```

## Cost Estimation

### Google Gemini Flash Pricing (as of 2024)
- **Model**: Gemini 1.5 Flash (with Vision)
- **Input**: $0.075 per million tokens
- **Output**: $0.30 per million tokens
- **Free Tier**: 1,500 requests per day!

**Estimated cost per menu upload:**
- Average menu: 2-4 images
- Cost per upload: ~$0.0005 - $0.001 (essentially FREE with free tier!)
- 1000 restaurants: ~$0.50 - $1.00
- **60x cheaper than Claude!** 🎉

Extremely affordable for production use!

## Error Handling

The system handles:
- ✅ Invalid image formats
- ✅ API rate limits (automatic retry)
- ✅ Network failures
- ✅ Malformed API responses
- ✅ Missing fields in extracted data

Errors are logged and images are cleaned up on failure.

## Best Practices

1. **Image Quality**: Use clear, well-lit photos of menus
2. **Multiple Pages**: Upload all menu pages in one batch
3. **Review Items**: Always review flagged items before publishing
4. **Update Regularly**: Keep menu synchronized with actual offerings
5. **Test Extraction**: Try with sample images first

## Troubleshooting

### "Failed to extract menu items"
- Check ANTHROPIC_API_KEY is set correctly
- Verify API key has sufficient credits
- Check image file size (<10MB)

### No items extracted
- Ensure menu text is clearly visible
- Try higher resolution images
- Check image is not too blurry

### Wrong prices extracted
- Review and manually correct
- Use clearer price formatting in photos

## Production Deployment

1. Set `ANTHROPIC_API_KEY` in production environment
2. Ensure `static/menu_uploads/` has write permissions
3. Consider CDN for menu images
4. Set up monitoring for API usage
5. Implement rate limiting if needed

## Next Steps

1. ✅ Backend implementation (DONE)
2. 🔲 Create React Native review screen component
3. 🔲 Add menu upload button in restaurant profile
4. 🔲 Display public menu in restaurant page
5. 🔲 Add analytics dashboard for menu views

## Support

For issues or questions:
- Check logs: `pm2 logs cofau-backend`
- Test endpoints with cURL
- Verify MongoDB connection
- Check Claude API quota

---

**Built with Google Gemini Flash Vision API** 🤖
