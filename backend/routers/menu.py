from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import shutil
import os
from pathlib import Path

from models.menu import (
    MenuExtractionRequest,
    MenuExtractionResponse,
    MenuItem,
    MenuItemUpdate,
    MenuItemDB,
    PublishMenuRequest,
    MenuResponse
)
from utils.menu_extraction_gemini import menu_extraction_service
from routers.restaurant_auth import get_current_restaurant
from database import get_database

router = APIRouter(prefix="/api/restaurant/menu", tags=["Menu Management"])

# Upload directory for menu images
MENU_UPLOAD_DIR = "static/menu_uploads"
os.makedirs(MENU_UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=MenuExtractionResponse)
async def upload_menu_images(
    files: List[UploadFile] = File(...),
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Upload menu images and automatically extract items using AI

    - Accepts multiple menu images (photos of physical menus)
    - Uses Claude Vision API to extract menu items
    - Returns extracted items with confidence scores
    - Flags items that need manual review
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    # Generate extraction ID for this batch
    extraction_id = str(ObjectId())

    # Save uploaded files
    image_paths = []
    for file in files:
        # Validate file type
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")

        # Generate unique filename
        file_id = str(ObjectId())
        file_extension = Path(file.filename).suffix
        filename = f"{restaurant_id}_{file_id}{file_extension}"
        file_path = os.path.join(MENU_UPLOAD_DIR, filename)

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        image_paths.append(file_path)

    # Extract menu items using AI
    try:
        extracted_items = await menu_extraction_service.extract_menu_items(image_paths)
    except Exception as e:
        # Clean up uploaded files on error
        for path in image_paths:
            if os.path.exists(path):
                os.remove(path)
        raise HTTPException(status_code=500, detail=f"Failed to extract menu items: {str(e)}")

    # Save extracted items to database
    items_to_insert = []
    for idx, item in enumerate(extracted_items):
        item_doc = {
            "_id": ObjectId(),
            "restaurant_id": restaurant_id,
            "name": item.name,
            "price": item.price,
            "category": item.category,
            "description": item.description,
            "confidence": item.confidence,
            "needs_review": item.needs_review,
            "status": "pending",  # pending, approved, rejected
            "image_url": image_paths[idx // (len(extracted_items) // len(image_paths)) if len(extracted_items) > 0 else 0] if image_paths else None,
            "extraction_id": extraction_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        items_to_insert.append(item_doc)

    if items_to_insert:
        await db.menu_items.insert_many(items_to_insert)

    # Convert to MenuItemDB objects with IDs
    db_items = []
    for item_doc in items_to_insert:
        db_items.append(MenuItemDB(
            id=str(item_doc["_id"]),
            restaurant_id=item_doc["restaurant_id"],
            name=item_doc["name"],
            price=item_doc.get("price"),
            category=item_doc.get("category"),
            description=item_doc.get("description"),
            confidence=item_doc["confidence"],
            needs_review=item_doc["needs_review"],
            status=item_doc["status"],
            image_url=item_doc.get("image_url"),
            extraction_id=item_doc["extraction_id"],
            created_at=item_doc["created_at"],
            updated_at=item_doc["updated_at"]
        ))

    # Count items that need review
    needs_review_count = sum(1 for item in db_items if item.needs_review)

    return MenuExtractionResponse(
        items=db_items,
        total_items=len(db_items),
        needs_review_count=needs_review_count,
        extraction_id=extraction_id
    )


@router.get("/pending", response_model=List[MenuItemDB])
async def get_pending_items(
    extraction_id: Optional[str] = None,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Get all pending menu items for review

    - Returns items extracted from uploaded menus
    - Optionally filter by extraction_id (specific upload batch)
    - Includes confidence scores and flags for items needing review
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    query = {
        "restaurant_id": restaurant_id,
        "status": "pending"
    }

    if extraction_id:
        query["extraction_id"] = extraction_id

    items = await db.menu_items.find(query).sort("created_at", -1).to_list(length=None)

    # Convert to response model
    response_items = []
    for item in items:
        response_items.append(MenuItemDB(
            id=str(item["_id"]),
            restaurant_id=item["restaurant_id"],
            name=item["name"],
            price=item.get("price"),
            category=item.get("category"),
            description=item.get("description"),
            confidence=item["confidence"],
            needs_review=item["needs_review"],
            status=item["status"],
            image_url=item.get("image_url"),
            extraction_id=item["extraction_id"],
            created_at=item["created_at"],
            updated_at=item["updated_at"]
        ))

    return response_items


@router.put("/items/{item_id}", response_model=MenuItemDB)
async def update_menu_item(
    item_id: str,
    update_data: MenuItemUpdate,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Update/correct a menu item

    - Allows restaurant to fix any extraction errors
    - Update name, price, category, or description
    - Mark item as reviewed by setting needs_review to False
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    # Find the item
    item = await db.menu_items.find_one({
        "_id": ObjectId(item_id),
        "restaurant_id": restaurant_id
    })

    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    # Prepare update data
    update_dict = {}
    if update_data.name is not None:
        update_dict["name"] = update_data.name
    if update_data.price is not None:
        update_dict["price"] = update_data.price
    if update_data.category is not None:
        update_dict["category"] = update_data.category
    if update_data.description is not None:
        update_dict["description"] = update_data.description
    if update_data.needs_review is not None:
        update_dict["needs_review"] = update_data.needs_review

    update_dict["updated_at"] = datetime.utcnow()

    # Update in database
    await db.menu_items.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": update_dict}
    )

    # Fetch updated item
    updated_item = await db.menu_items.find_one({"_id": ObjectId(item_id)})

    return MenuItemDB(
        id=str(updated_item["_id"]),
        restaurant_id=updated_item["restaurant_id"],
        name=updated_item["name"],
        price=updated_item.get("price"),
        category=updated_item.get("category"),
        description=updated_item.get("description"),
        confidence=updated_item["confidence"],
        needs_review=updated_item["needs_review"],
        status=updated_item["status"],
        image_url=updated_item.get("image_url"),
        extraction_id=updated_item["extraction_id"],
        created_at=updated_item["created_at"],
        updated_at=updated_item["updated_at"]
    )


@router.delete("/items/{item_id}")
async def delete_menu_item(
    item_id: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Delete a menu item

    - Remove incorrectly extracted items
    - Can only delete items belonging to the authenticated restaurant
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    result = await db.menu_items.delete_one({
        "_id": ObjectId(item_id),
        "restaurant_id": restaurant_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return {"message": "Menu item deleted successfully"}


@router.post("/publish")
async def publish_menu(
    request: PublishMenuRequest,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Publish approved menu items

    - Mark selected items as approved
    - Makes them visible on the restaurant's public menu
    - Can publish all or selected items
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    # Update status of selected items
    item_object_ids = [ObjectId(item_id) for item_id in request.item_ids]

    result = await db.menu_items.update_many(
        {
            "_id": {"$in": item_object_ids},
            "restaurant_id": restaurant_id
        },
        {
            "$set": {
                "status": "approved",
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": f"Successfully published {result.modified_count} menu items",
        "published_count": result.modified_count
    }


@router.post("/publish-all")
async def publish_all_pending(
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Publish all pending menu items

    - Approves all items with status "pending"
    - Quick way to publish entire extracted menu
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    result = await db.menu_items.update_many(
        {
            "restaurant_id": restaurant_id,
            "status": "pending"
        },
        {
            "$set": {
                "status": "approved",
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": f"Successfully published {result.modified_count} menu items",
        "published_count": result.modified_count
    }


# Public endpoint - No authentication required
@router.get("/{restaurant_id}/public", response_model=MenuResponse)
async def get_restaurant_menu(restaurant_id: str):
    """
    Get published menu for a restaurant (PUBLIC)

    - Returns all approved menu items
    - No authentication required
    - Grouped by categories
    """
    db = get_database()
    # Get restaurant details - try both ObjectId and string format
    try:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    except:
        # If ObjectId conversion fails, try as string
        restaurant = await db.restaurants.find_one({"_id": restaurant_id})

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Get approved menu items
    items = await db.menu_items.find({
        "restaurant_id": restaurant_id,
        "status": "approved"
    }).sort("category", 1).to_list(length=None)

    if not items:
        return MenuResponse(
            restaurant_id=restaurant_id,
            restaurant_name=restaurant.get("name", "Unknown Restaurant"),
            items=[],
            total_items=0,
            categories=[],
            last_updated=datetime.utcnow()
        )

    # Convert to response model
    menu_items = []
    categories = set()
    latest_update = datetime.min

    for item in items:
        menu_items.append(MenuItemDB(
            id=str(item["_id"]),
            restaurant_id=item["restaurant_id"],
            name=item["name"],
            price=item.get("price"),
            category=item.get("category"),
            description=item.get("description"),
            confidence=item["confidence"],
            needs_review=item["needs_review"],
            status=item["status"],
            image_url=item.get("image_url"),
            extraction_id=item["extraction_id"],
            created_at=item["created_at"],
            updated_at=item["updated_at"]
        ))

        if item.get("category"):
            categories.add(item["category"])

        if item["updated_at"] > latest_update:
            latest_update = item["updated_at"]

    return MenuResponse(
        restaurant_id=restaurant_id,
        restaurant_name=restaurant.get("name", "Unknown Restaurant"),
        items=menu_items,
        total_items=len(menu_items),
        categories=sorted(list(categories)),
        last_updated=latest_update
    )


@router.get("/stats")
async def get_menu_stats(
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Get menu statistics for the restaurant

    - Total items (pending, approved, rejected)
    - Items needing review
    - Categories breakdown
    """
    db = get_database()
    restaurant_id = str(current_restaurant["_id"])

    # Count by status
    pending_count = await db.menu_items.count_documents({
        "restaurant_id": restaurant_id,
        "status": "pending"
    })

    approved_count = await db.menu_items.count_documents({
        "restaurant_id": restaurant_id,
        "status": "approved"
    })

    needs_review_count = await db.menu_items.count_documents({
        "restaurant_id": restaurant_id,
        "needs_review": True,
        "status": "pending"
    })

    # Get categories
    pipeline = [
        {"$match": {"restaurant_id": restaurant_id, "status": "approved"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]

    categories = await db.menu_items.aggregate(pipeline).to_list(length=None)

    return {
        "total_items": pending_count + approved_count,
        "pending_items": pending_count,
        "approved_items": approved_count,
        "needs_review": needs_review_count,
        "categories": [
            {"name": cat["_id"] or "Uncategorized", "count": cat["count"]}
            for cat in categories
        ]
    }
