from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/orders", tags=["Orders"])


class OrderCreate(BaseModel):
    post_id: str
    restaurant_id: Optional[str] = None
    restaurant_name: Optional[str] = None
    dish_name: str
    suggestions: Optional[str] = None
    post_location: Optional[str] = None
    post_media_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/create")
async def create_order(
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new order from a food post"""
    db = get_database()

    user_id = str(current_user.get("_id") or current_user.get("id"))

    # Verify post exists
    try:
        post = await db.posts.find_one({"_id": ObjectId(order_data.post_id)})
        if not post:
            # Try restaurant_posts collection
            post = await db.restaurant_posts.find_one({"_id": ObjectId(order_data.post_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid post ID")

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Create order document
    order_doc = {
        "user_id": user_id,
        "post_id": order_data.post_id,
        "restaurant_id": order_data.restaurant_id,
        "restaurant_name": order_data.restaurant_name,
        "dish_name": order_data.dish_name.strip(),
        "suggestions": order_data.suggestions.strip() if order_data.suggestions else "",
        "post_location": order_data.post_location,
        "post_media_url": order_data.post_media_url,
        "latitude": order_data.latitude,
        "longitude": order_data.longitude,
        "status": "pending",  # pending, confirmed, preparing, ready, completed, cancelled
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.orders.insert_one(order_doc)
    order_id = str(result.inserted_id)

    print(f"✅ Order created: {order_id} by user {user_id}")

    return {
        "success": True,
        "message": "Order placed successfully",
        "order_id": order_id,
    }


@router.get("/my-orders")
async def get_my_orders(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's orders"""
    db = get_database()

    user_id = str(current_user.get("_id") or current_user.get("id"))

    query = {"user_id": user_id}

    if status:
        query["status"] = status

    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for order in orders:
        result.append({
            "id": str(order["_id"]),
            "post_id": order.get("post_id"),
            "restaurant_id": order.get("restaurant_id"),
            "restaurant_name": order.get("restaurant_name"),
            "dish_name": order.get("dish_name"),
            "suggestions": order.get("suggestions", ""),
            "post_location": order.get("post_location"),
            "post_media_url": order.get("post_media_url"),
            "latitude": order.get("latitude"),
            "longitude": order.get("longitude"),
            "status": order.get("status", "pending"),
            "created_at": order["created_at"].isoformat() if isinstance(order.get("created_at"), datetime) else order.get("created_at", ""),
            "updated_at": order["updated_at"].isoformat() if isinstance(order.get("updated_at"), datetime) else order.get("updated_at", ""),
        })

    return result


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific order by ID"""
    db = get_database()

    user_id = str(current_user.get("_id") or current_user.get("id"))

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify ownership
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    return {
        "id": str(order["_id"]),
        "post_id": order.get("post_id"),
        "restaurant_id": order.get("restaurant_id"),
        "restaurant_name": order.get("restaurant_name"),
        "dish_name": order.get("dish_name"),
        "suggestions": order.get("suggestions", ""),
        "post_location": order.get("post_location"),
        "post_media_url": order.get("post_media_url"),
        "latitude": order.get("latitude"),
        "longitude": order.get("longitude"),
        "status": order.get("status", "pending"),
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
    }


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """Update order status (for future use by restaurants)"""
    db = get_database()

    valid_statuses = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]

    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update the order status
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update order status")

    return {
        "success": True,
        "message": f"Order status updated to {status}",
        "order_id": order_id,
        "status": status
    }


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel an order"""
    db = get_database()

    user_id = str(current_user.get("_id") or current_user.get("id"))

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify ownership
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this order")

    # Update status to cancelled instead of deleting
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "status": "cancelled",
                "updated_at": datetime.utcnow()
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to cancel order")

    return {
        "success": True,
        "message": "Order cancelled successfully",
        "order_id": order_id
    }
