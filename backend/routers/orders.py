from fastapi import APIRouter, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect, status as http_status
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from pydantic import BaseModel
from typing import Optional, List, Dict
import re

router = APIRouter(prefix="/api/orders", tags=["Orders"])

# Import WebSocket manager from chat router for real-time updates
from routers.chat import manager as websocket_manager
from utils.jwt import decode_access_token, verify_token
from routers.restaurant_auth import oauth2_scheme
from routers.notifications import create_notification

# Partner PIN (hardcoded for now - can be moved to env later)
PARTNER_PIN = "1234"


def verify_partner_pin(pin: str):
    """Verify partner PIN"""
    if pin != PARTNER_PIN:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return True


class PartnerLogin(BaseModel):
    pin: str


class OrderCreate(BaseModel):
    post_id: str
    restaurant_id: Optional[str] = None
    restaurant_name: Optional[str] = None
    dish_name: str
    total_price: Optional[float] = None
    suggestions: Optional[str] = None
    post_location: Optional[str] = None
    post_media_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ReviewCreate(BaseModel):
    rating: int
    review_text: str
    is_complaint: bool = False


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
        "total_price": order_data.total_price,
        "suggestions": order_data.suggestions.strip() if order_data.suggestions else "",
        "post_location": order_data.post_location,
        "post_media_url": order_data.post_media_url,
        "latitude": order_data.latitude,
        "longitude": order_data.longitude,
        "status": "pending",  # pending, accepted, preparing, out_for_delivery, completed, cancelled
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.orders.insert_one(order_doc)
    order_id = str(result.inserted_id)

    print(f"✅ Order created: {order_id} by user {user_id}")

    # Send push notification to restaurant when new order is placed
    restaurant_id = order_data.restaurant_id
    if restaurant_id:
        try:
            # Get customer name
            customer_name = current_user.get("full_name", "A customer")
            dish_name = order_data.dish_name
            restaurant_name = order_data.restaurant_name or "your restaurant"

            await create_notification(
                db=db,
                notification_type="new_order",
                from_user_id=user_id,
                to_user_id=restaurant_id,
                message=f"🍽️ New order from {customer_name}: {dish_name}",
                send_push=True
            )
            print(f"✅ Sent new order notification to restaurant {restaurant_id}")
        except Exception as e:
            print(f"⚠️ Error sending notification to restaurant: {e}")
            # Don't fail the order creation if notification fails
            import traceback
            traceback.print_exc()

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
        # Get price from the order
        price = order.get("total_price") or order.get("price")

        # Check if review exists for this order
        order_id = str(order["_id"])
        existing_review = await db.reviews.find_one({"order_id": order_id})
        has_review = existing_review is not None

        # Get restaurant profile picture
        restaurant_profile_picture = None
        restaurant_id = order.get("restaurant_id")
        if restaurant_id:
            try:
                restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
                if restaurant:
                    restaurant_profile_picture = restaurant.get("profile_picture")
            except Exception as e:
                print(f"Error fetching restaurant profile picture: {e}")

        result.append({
            "id": order_id,
            "post_id": order.get("post_id"),
            "restaurant_id": order.get("restaurant_id"),
            "restaurant_name": order.get("restaurant_name"),
            "restaurant_profile_picture": restaurant_profile_picture,
            "dish_name": order.get("dish_name"),
            "price": price,
            "suggestions": order.get("suggestions", ""),
            "post_location": order.get("post_location"),
            "post_media_url": order.get("post_media_url"),
            "latitude": order.get("latitude"),
            "longitude": order.get("longitude"),
            "status": order.get("status", "pending"),
            "has_review": has_review,
            "created_at": order["created_at"].isoformat() if isinstance(order.get("created_at"), datetime) else order.get("created_at", ""),
            "updated_at": order["updated_at"].isoformat() if isinstance(order.get("updated_at"), datetime) else order.get("updated_at", ""),
        })

    return result


# Import restaurant auth for the new endpoint
from routers.restaurant_auth import get_current_restaurant


@router.get("/restaurant-orders")
async def get_restaurant_orders(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Get orders placed at this restaurant (for restaurant accounts)"""
    db = get_database()

    restaurant_id = str(current_restaurant.get("_id"))

    # Find orders where restaurant_id matches this restaurant
    query = {"restaurant_id": restaurant_id}

    if status:
        query["status"] = status

    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    result = []
    for order in orders:
        # Get customer info (NO phone or delivery address - only for partner dashboard)
        customer_name = "Unknown Customer"
        customer_profile_picture = None

        user_id = order.get("user_id")
        if user_id:
            try:
                customer = await db.users.find_one({"_id": ObjectId(user_id)})
                if customer:
                    customer_name = customer.get("full_name", "Unknown Customer")
                    customer_profile_picture = customer.get("profile_picture")
            except Exception as e:
                print(f"Error fetching customer info: {e}")

        # Get price from the post or calculate from menu items
        price = None
        total_price = 0
        post_id = order.get("post_id")

        # First try to get price from the order itself (if stored)
        if order.get("total_price"):
            price = order.get("total_price")
        elif order.get("price"):
            price = order.get("price")

        # If no price in order, try to calculate from menu items
        if not price and order.get("dish_name"):
            dish_name = order.get("dish_name", "")
            # Parse dish items format: "Item1 x2, Item2 x1"
            items = dish_name.split(',')
            for item in items:
                item = item.strip()
                # Try to match "ItemName xQuantity" pattern
                match = re.match(r'^(.+?)\s+x(\d+)$', item)
                if match:
                    item_name = match.group(1).strip()
                    quantity = int(match.group(2))
                    # Look up menu item price
                    menu_item = await db.menu_items.find_one({
                        "restaurant_id": restaurant_id,
                        "name": {"$regex": f"^{re.escape(item_name)}$", "$options": "i"}
                    })
                    if menu_item and menu_item.get("price"):
                        total_price += float(menu_item.get("price")) * quantity

            if total_price > 0:
                price = total_price

        # Fallback: try to get price from post
        if not price and post_id:
            try:
                # Check restaurant_posts first
                post = await db.restaurant_posts.find_one({"_id": ObjectId(post_id)})
                if post and post.get("price"):
                    price = post.get("price")
                else:
                    # Try regular posts
                    post = await db.posts.find_one({"_id": ObjectId(post_id)})
                    if post and post.get("price"):
                        price = post.get("price")
            except Exception as e:
                print(f"Error fetching post price: {e}")

        result.append({
            "id": str(order["_id"]),
            "post_id": order.get("post_id"),
            "restaurant_id": order.get("restaurant_id"),
            "restaurant_name": order.get("restaurant_name"),
            "dish_name": order.get("dish_name"),
            "price": price,
            "suggestions": order.get("suggestions", ""),
            "post_location": order.get("post_location"),
            "post_media_url": order.get("post_media_url"),
            "latitude": order.get("latitude"),
            "longitude": order.get("longitude"),
            "status": order.get("status", "pending"),
            "customer_name": customer_name,
            "customer_profile_picture": customer_profile_picture,
            # NO customer_phone or delivery_address - only available in partner dashboard
            "created_at": order["created_at"].isoformat() if isinstance(order.get("created_at"), datetime) else order.get("created_at", ""),
            "updated_at": order["updated_at"].isoformat() if isinstance(order.get("updated_at"), datetime) else order.get("updated_at", ""),
        })

    return result


@router.patch("/restaurant-orders/{order_id}/status")
async def update_restaurant_order_status(
    order_id: str,
    status: str,
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """Update order status (for restaurant accounts)"""
    db = get_database()

    restaurant_id = str(current_restaurant.get("_id"))
    valid_statuses = ["pending", "accepted", "preparing", "out_for_delivery", "completed", "cancelled"]

    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify this order belongs to this restaurant
    if order.get("restaurant_id") != restaurant_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this order")

    # Update the order status
    now = datetime.utcnow()
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "status": status,
                "updated_at": now
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update order status")

    print(f"✅ Restaurant {restaurant_id} updated order {order_id} to {status}")

    # Send notifications when order status changes to "preparing" (In Progress)
    if status == "preparing":
        user_id = order.get("user_id")
        restaurant_name = order.get("restaurant_name", "Restaurant")
        dish_name = order.get("dish_name", "your order")

        # Notify the customer
        if user_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_preparing",
                    from_user_id=restaurant_id,
                    to_user_id=user_id,
                    message=f"🍳 {restaurant_name} is now preparing {dish_name}!",
                    send_push=True
                )
                print(f"✅ Sent 'preparing' notification to customer {user_id}")
            except Exception as e:
                print(f"⚠️ Error sending notification to customer: {e}")

        # Notify the restaurant (confirmation)
        try:
            await create_notification(
                db=db,
                notification_type="order_in_progress",
                from_user_id=user_id if user_id else restaurant_id,
                to_user_id=restaurant_id,
                message=f"✅ Order for {dish_name} is now In Progress",
                send_push=True
            )
            print(f"✅ Sent 'in progress' confirmation to restaurant {restaurant_id}")
        except Exception as e:
            print(f"⚠️ Error sending notification to restaurant: {e}")

    # If order is completed, notify customer and track user's delivery reward progress
    if status == "completed":
        user_id = order.get("user_id")
        restaurant_id = order.get("restaurant_id")
        dish_name = order.get("dish_name", "your order")

        # Send congratulations notification to customer
        if user_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_completed",
                    from_user_id=restaurant_id if restaurant_id else user_id,
                    to_user_id=user_id,
                    message=f"🎉 Congratulations! Enjoy your food and earn reward ₹10/-",
                    send_push=True
                )
                print(f"✅ Sent completion notification to customer {user_id}")
            except Exception as e:
                print(f"⚠️ Error sending completion notification to customer: {e}")

        # Track user's delivery reward progress
        if user_id:
            try:
                # Get user's current completed deliveries count
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    completed_deliveries = user.get("completed_deliveries_count", 0)
                    completed_deliveries += 1

                    print(f"💰 User {user_id} completed delivery {completed_deliveries}/10")

                    # Check if user reached 10 deliveries
                    if completed_deliveries >= 10:
                        # Add ₹100 to wallet
                        current_balance = user.get("wallet_balance", 0.0)
                        new_balance = current_balance + 100.0

                        await db.users.update_one(
                            {"_id": ObjectId(user_id)},
                            {
                                "$set": {
                                    "wallet_balance": new_balance,
                                    "completed_deliveries_count": 0  # Reset counter
                                }
                            }
                        )

                        # Create wallet transaction
                        transaction_doc = {
                            "user_id": user_id,
                            "amount": 100.0,
                            "type": "earning",
                            "description": "Earned for completing 10 deliveries",
                            "created_at": now
                        }
                        await db.wallet_transactions.insert_one(transaction_doc)

                        print(f"🎉 User {user_id} earned ₹100 for completing 10 deliveries! Balance: ₹{new_balance}")
                    else:
                        # Just increment the counter
                        await db.users.update_one(
                            {"_id": ObjectId(user_id)},
                            {"$set": {"completed_deliveries_count": completed_deliveries}}
                        )
            except Exception as e:
                print(f"⚠️ Error tracking delivery reward: {e}")

    # Send real-time WebSocket update to the customer
    user_id = order.get("user_id")
    if user_id:
        try:
            await websocket_manager.send_personal_message(user_id, {
                "type": "order_status_update",
                "order_id": order_id,
                "status": status,
                "updated_at": now.isoformat() + "Z"
            })
            print(f"📡 Sent WebSocket update to user {user_id} for order {order_id}")
        except Exception as e:
            print(f"⚠️ Failed to send WebSocket update: {str(e)}")

    return {
        "success": True,
        "message": f"Order status updated to {status}",
        "order_id": order_id,
        "status": status
    }


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

    valid_statuses = ["pending", "accepted", "preparing", "out_for_delivery", "completed", "cancelled"]

    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update the order status
    now = datetime.utcnow()
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "status": status,
                "updated_at": now
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update order status")

    print(f"✅ Order {order_id} updated to {status}")

    # Send notifications when order status changes to "preparing" (In Progress)
    if status == "preparing":
        user_id = order.get("user_id")
        restaurant_id = order.get("restaurant_id")
        restaurant_name = order.get("restaurant_name", "Restaurant")
        dish_name = order.get("dish_name", "your order")

        # Notify the customer
        if user_id and restaurant_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_preparing",
                    from_user_id=restaurant_id,
                    to_user_id=user_id,
                    message=f"🍳 {restaurant_name} is now preparing {dish_name}!",
                    send_push=True
                )
                print(f"✅ Sent 'preparing' notification to customer {user_id}")
            except Exception as e:
                print(f"⚠️ Error sending notification to customer: {e}")

        # Notify the restaurant (confirmation)
        if restaurant_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_in_progress",
                    from_user_id=user_id if user_id else restaurant_id,
                    to_user_id=restaurant_id,
                    message=f"✅ Order for {dish_name} is now In Progress",
                    send_push=True
                )
                print(f"✅ Sent 'in progress' confirmation to restaurant {restaurant_id}")
            except Exception as e:
                print(f"⚠️ Error sending notification to restaurant: {e}")

    # If order is completed, notify customer and track user's delivery reward progress
    if status == "completed":
        user_id = order.get("user_id")
        restaurant_id = order.get("restaurant_id")
        dish_name = order.get("dish_name", "your order")

        # Send congratulations notification to customer
        if user_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_completed",
                    from_user_id=restaurant_id if restaurant_id else user_id,
                    to_user_id=user_id,
                    message=f"🎉 Congratulations! Enjoy your food and earn reward ₹10/-",
                    send_push=True
                )
                print(f"✅ Sent completion notification to customer {user_id}")
            except Exception as e:
                print(f"⚠️ Error sending completion notification to customer: {e}")

        # Track user's delivery reward progress
        if user_id:
            try:
                # Get user's current completed deliveries count
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    completed_deliveries = user.get("completed_deliveries_count", 0)
                    completed_deliveries += 1

                    print(f"💰 User {user_id} completed delivery {completed_deliveries}/10")

                    # Check if user reached 10 deliveries
                    if completed_deliveries >= 10:
                        # Add ₹100 to wallet
                        current_balance = user.get("wallet_balance", 0.0)
                        new_balance = current_balance + 100.0

                        await db.users.update_one(
                            {"_id": ObjectId(user_id)},
                            {
                                "$set": {
                                    "wallet_balance": new_balance,
                                    "completed_deliveries_count": 0  # Reset counter
                                }
                            }
                        )

                        # Create wallet transaction
                        transaction_doc = {
                            "user_id": user_id,
                            "amount": 100.0,
                            "type": "earning",
                            "description": "Earned for completing 10 deliveries",
                            "created_at": now
                        }
                        await db.wallet_transactions.insert_one(transaction_doc)

                        print(f"🎉 User {user_id} earned ₹100 for completing 10 deliveries! Balance: ₹{new_balance}")
                    else:
                        # Just increment the counter
                        await db.users.update_one(
                            {"_id": ObjectId(user_id)},
                            {"$set": {"completed_deliveries_count": completed_deliveries}}
                        )
            except Exception as e:
                print(f"⚠️ Error tracking delivery reward: {e}")

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


# ==================== PARTNER DASHBOARD ENDPOINTS ====================

@router.post("/partner/login")
async def partner_login(login_data: PartnerLogin):
    """Partner login with PIN"""
    try:
        verify_partner_pin(login_data.pin)
        return {
            "success": True,
            "message": "Login successful"
        }
    except HTTPException:
        return {
            "success": False,
            "message": "Invalid PIN"
        }


@router.get("/partner/all")
async def get_all_orders_for_partner(
    pin: Optional[str] = Header(None, alias="X-Partner-PIN")
):
    """Get all orders grouped by status for partner dashboard"""
    # Verify PIN from header
    if not pin:
        raise HTTPException(status_code=401, detail="PIN required in X-Partner-PIN header")

    verify_partner_pin(pin)

    db = get_database()

    # Get all orders
    all_orders = await db.orders.find().sort("created_at", -1).to_list(None)

    # Group orders by status
    orders_by_status = {
        "pending": [],
        "accepted": [],
        "preparing": [],
        "out_for_delivery": [],
        "completed": [],
        "cancelled": []
    }

    # Helper function to calculate distance in km
    def calculate_distance_km(lat1, lon1, lat2, lon2):
        import math
        if not all([lat1, lon1, lat2, lon2]):
            return None
        R = 6371  # Earth's radius in km
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(d_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    for order in all_orders:
        order_id = str(order["_id"])
        user_id = order.get("user_id")
        restaurant_id = order.get("restaurant_id")

        # Get customer info and delivery coordinates
        customer = None
        user_lat = None
        user_lng = None
        customer_name = "Unknown Customer"
        delivery_address = "No address provided"
        customer_phone = None

        if user_id:
            try:
                customer = await db.users.find_one({"_id": ObjectId(user_id)})
                if customer:
                    customer_name = customer.get("full_name", "Unknown Customer")
                    # Get delivery address from user's delivery_address field
                    user_address = customer.get("delivery_address")
                    if user_address:
                        user_lat = user_address.get("latitude")
                        user_lng = user_address.get("longitude")
                        customer_phone = user_address.get("phone_number")
                        # Build delivery address string
                        addr_parts = []
                        if user_address.get("house_number"):
                            addr_parts.append(user_address.get("house_number"))
                        if user_address.get("street_address"):
                            addr_parts.append(user_address.get("street_address"))
                        if user_address.get("address"):
                            addr_parts.append(user_address.get("address"))
                        if addr_parts:
                            delivery_address = ", ".join(addr_parts)
            except:
                pass

        # Get restaurant coordinates and phone
        restaurant_lat = None
        restaurant_lng = None
        restaurant_phone = None
        restaurant_profile_name = order.get("restaurant_name", "Unknown Restaurant")
        if restaurant_id:
            try:
                restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
                if restaurant:
                    restaurant_lat = restaurant.get("latitude")
                    restaurant_lng = restaurant.get("longitude")
                    restaurant_phone = restaurant.get("phone_number") or restaurant.get("phone")
                    restaurant_profile_name = restaurant.get("restaurant_name", restaurant_profile_name)
            except:
                pass

        # Calculate distance
        distance_km = calculate_distance_km(restaurant_lat, restaurant_lng, user_lat, user_lng)

        # Get total price
        price = order.get("total_price") or order.get("price")

        order_data = {
            "order_id": order_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "delivery_address": delivery_address,
            "dish_name": order.get("dish_name", "Unknown Dish"),
            "suggestions": order.get("suggestions", ""),
            "post_media_url": order.get("post_media_url", ""),
            "restaurant_name": order.get("restaurant_name", "Unknown Restaurant"),
            "restaurant_profile_name": restaurant_profile_name,
            "restaurant_phone": restaurant_phone,
            "post_location": order.get("post_location", ""),
            "status": order.get("status", "pending"),
            "price": price,
            "restaurant_lat": restaurant_lat,
            "restaurant_lng": restaurant_lng,
            "user_lat": user_lat,
            "user_lng": user_lng,
            "distance_km": distance_km,
            "created_at": order["created_at"].isoformat() if isinstance(order.get("created_at"), datetime) else order.get("created_at", ""),
            "updated_at": order["updated_at"].isoformat() if isinstance(order.get("updated_at"), datetime) else order.get("updated_at", "")
        }

        status = order.get("status", "pending")
        if status in orders_by_status:
            orders_by_status[status].append(order_data)

    return orders_by_status


@router.patch("/partner/{order_id}/status")
async def update_order_status_partner(
    order_id: str,
    status: str,
    pin: Optional[str] = Header(None, alias="X-Partner-PIN")
):
    """Update order status for partner (no user auth required, just PIN)"""
    # Verify PIN from header
    if not pin:
        raise HTTPException(status_code=401, detail="PIN required in X-Partner-PIN header")

    verify_partner_pin(pin)

    db = get_database()

    valid_statuses = ["pending", "accepted", "preparing", "out_for_delivery", "completed", "cancelled"]

    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update the order status
    now = datetime.utcnow()
    result = await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "status": status,
                "updated_at": now
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to update order status")

    print(f"✅ Partner updated order {order_id} to {status}")

    # Send notifications when order status changes to "preparing" (In Progress)
    if status == "preparing":
        user_id = order.get("user_id")
        restaurant_id = order.get("restaurant_id")
        restaurant_name = order.get("restaurant_name", "Restaurant")
        dish_name = order.get("dish_name", "your order")

        # Notify the customer
        if user_id and restaurant_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_preparing",
                    from_user_id=restaurant_id,
                    to_user_id=user_id,
                    message=f"🍳 {restaurant_name} is now preparing {dish_name}!",
                    send_push=True
                )
                print(f"✅ Sent 'preparing' notification to customer {user_id}")
            except Exception as e:
                print(f"⚠️ Error sending notification to customer: {e}")

        # Notify the restaurant (confirmation)
        if restaurant_id:
            try:
                await create_notification(
                    db=db,
                    notification_type="order_in_progress",
                    from_user_id=user_id if user_id else restaurant_id,
                    to_user_id=restaurant_id,
                    message=f"✅ Order for {dish_name} is now In Progress",
                    send_push=True
                )
                print(f"✅ Sent 'in progress' confirmation to restaurant {restaurant_id}")
            except Exception as e:
                print(f"⚠️ Error sending notification to restaurant: {e}")

    # Send real-time WebSocket update to the customer
    user_id = order.get("user_id")
    if user_id:
        try:
            await websocket_manager.send_personal_message(user_id, {
                "type": "order_status_update",
                "order_id": order_id,
                "status": status,
                "updated_at": now.isoformat() + "Z"
            })
            print(f"📡 Sent WebSocket update to user {user_id} for order {order_id}")
        except Exception as e:
            print(f"⚠️ Failed to send WebSocket update: {str(e)}")

    # If order is completed, track user's delivery reward progress
    if status == "completed" and user_id:
        try:
            # Get user's current completed deliveries count
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                completed_deliveries = user.get("completed_deliveries_count", 0)
                completed_deliveries += 1

                print(f"💰 User {user_id} completed delivery {completed_deliveries}/10 (via partner)")

                # Check if user reached 10 deliveries
                if completed_deliveries >= 10:
                    # Add ₹100 to wallet
                    current_balance = user.get("wallet_balance", 0.0)
                    new_balance = current_balance + 100.0

                    await db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {
                            "$set": {
                                "wallet_balance": new_balance,
                                "completed_deliveries_count": 0  # Reset counter
                            }
                        }
                    )

                    # Create wallet transaction
                    transaction_doc = {
                        "user_id": user_id,
                        "amount": 100.0,
                        "type": "earning",
                        "description": "Earned for completing 10 deliveries",
                        "created_at": now
                    }
                    await db.wallet_transactions.insert_one(transaction_doc)

                    print(f"🎉 User {user_id} earned ₹100 for completing 10 deliveries! Balance: ₹{new_balance}")
                else:
                    # Just increment the counter
                    await db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"completed_deliveries_count": completed_deliveries}}
                    )
        except Exception as e:
            print(f"⚠️ Error tracking delivery reward: {e}")

    return {
        "success": True,
        "message": f"Order status updated to {status}",
        "order_id": order_id,
        "status": status
    }


async def get_user_id_from_token(token: str) -> str:
    """Get user_id from JWT token by decoding and looking up user in database"""
    if not token:
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="Invalid token: no email in payload")

        db = get_database()
        user = await db.users.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail="User not found")

        return str(user["_id"])
    except ValueError as e:
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=http_status.HTTP_401_UNAUTHORIZED, detail=f"Token validation failed: {str(e)}")


@router.websocket("/ws")
async def orders_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time order status updates"""
    print(f"🔗 Order WebSocket connection attempt")

    try:
        await websocket.accept()
        print(f"✅ Order WebSocket connection accepted")
    except Exception as e:
        print(f"❌ Failed to accept WebSocket: {str(e)}")
        return

    token = websocket.query_params.get("token")
    if not token:
        print(f"❌ No token provided")
        await websocket.close(code=http_status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    try:
        user_id = await get_user_id_from_token(token)
        print(f"✅ Authenticated user for orders WebSocket: {user_id}")
    except HTTPException as e:
        print(f"❌ WebSocket auth error: {e.detail}")
        await websocket.close(code=http_status.WS_1008_POLICY_VIOLATION, reason=e.detail)
        return
    except Exception as e:
        print(f"❌ WebSocket error: {str(e)}")
        await websocket.close(code=http_status.WS_1011_INTERNAL_ERROR, reason="Internal server error")
        return

    try:
        await websocket_manager.connect(user_id, websocket)
        print(f"✅ Order WebSocket connected for user {user_id}")

        # Send initial connection success message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to order updates"
        })

        # Keep connection alive and listen for messages
        while True:
            try:
                # Receive any messages from client (e.g., ping/pong for keep-alive)
                data = await websocket.receive_json()
                # Echo back if it's a ping
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                raise
            except Exception as e:
                print(f"❌ Error processing WebSocket message: {str(e)}")
                continue

    except WebSocketDisconnect:
        print(f"🔌 Order WebSocket disconnected: {user_id}")
        websocket_manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"❌ Order WebSocket error: {str(e)}")
        websocket_manager.disconnect(user_id, websocket)
        try:
            await websocket.close(code=http_status.WS_1011_INTERNAL_ERROR, reason=str(e))
        except:
            pass


# ==================== REVIEW ENDPOINTS ====================

@router.post("/{order_id}/review")
async def submit_review(
    order_id: str,
    review_data: ReviewCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit a review for a completed order"""
    db = get_database()

    user_id = str(current_user.get("_id") or current_user.get("id"))

    # Validate order exists and belongs to user
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify ownership
    if order.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to review this order")

    # Check if order is completed
    if order.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed orders")

    # Check if review already exists
    existing_review = await db.reviews.find_one({"order_id": order_id})
    if existing_review:
        raise HTTPException(status_code=400, detail="Review already submitted for this order")

    # Validate rating (1-5)
    if not 1 <= review_data.rating <= 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    # Get customer info
    customer_name = current_user.get("full_name", "Anonymous")

    # Create review document
    restaurant_id = order.get("restaurant_id")
    restaurant_name = order.get("restaurant_name")

    print(f"📝 Creating review for order {order_id}")
    print(f"   Order restaurant_id: {restaurant_id}")
    print(f"   Order restaurant_name: {restaurant_name}")
    print(f"   Customer: {customer_name}")
    print(f"   Rating: {review_data.rating}/5")
    print(f"   Is complaint: {review_data.is_complaint}")

    if not restaurant_id:
        print(f"   ⚠️ WARNING: Order has no restaurant_id! Review will not be linked to restaurant.")

    review_doc = {
        "order_id": order_id,
        "user_id": user_id,
        "customer_name": customer_name,
        "restaurant_id": restaurant_id,
        "restaurant_name": restaurant_name,
        "dish_name": order.get("dish_name"),
        "rating": review_data.rating,
        "review_text": review_data.review_text.strip(),
        "is_complaint": review_data.is_complaint,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.reviews.insert_one(review_doc)
    review_id = str(result.inserted_id)

    print(f"✅ Review created: {review_id}")
    print(f"   Stored with restaurant_id: {restaurant_id}")

    return {
        "success": True,
        "message": "Review submitted successfully",
        "review_id": review_id,
    }


@router.get("/restaurant-reviews/{restaurant_id}")
async def get_restaurant_reviews_by_id(
    restaurant_id: str,
    token: str = Depends(oauth2_scheme),
    skip: int = 0,
    limit: int = 50
):
    """Get all reviews for a specific restaurant"""
    print(f"🎯 get_restaurant_reviews_by_id endpoint hit!")
    print(f"   Restaurant ID: {restaurant_id}")
    print(f"   Skip: {skip}, Limit: {limit}")

    # Verify token is valid (basic auth check)
    email = verify_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid authentication")

    db = get_database()

    # Verify restaurant exists
    try:
        restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid restaurant ID format")

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    print(f"🔍 Fetching reviews from 'reviews' collection for restaurant: {restaurant_id}")
    print(f"   Restaurant name: {restaurant.get('restaurant_name')}")

    # Find reviews for this restaurant
    reviews = await db.reviews.find(
        {"restaurant_id": restaurant_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    print(f"   Found {len(reviews)} reviews matching restaurant_id={restaurant_id}")

    result = []
    for review in reviews:
        # Get user profile picture
        user_id = review.get("user_id")
        user_profile_picture = None
        if user_id:
            try:
                user = await db.users.find_one({"_id": ObjectId(user_id)})
                if user:
                    user_profile_picture = user.get("profile_picture")
            except Exception as e:
                print(f"   ⚠️ Error fetching user profile picture: {e}")

        result.append({
            "id": str(review["_id"]),
            "order_id": review.get("order_id"),
            "user_id": user_id,
            "customer_name": review.get("customer_name", "Anonymous"),
            "customer_profile_picture": user_profile_picture,
            "dish_name": review.get("dish_name"),
            "rating": review.get("rating"),
            "review_text": review.get("review_text"),
            "is_complaint": review.get("is_complaint", False),
            "created_at": review["created_at"].isoformat() if isinstance(review.get("created_at"), datetime) else review.get("created_at", ""),
            "updated_at": review["updated_at"].isoformat() if isinstance(review.get("updated_at"), datetime) else review.get("updated_at", ""),
        })

    print(f"   ✅ Returning {len(result)} reviews")
    return result


# ==================== RESTAURANT SALES ANALYTICS ====================

@router.get("/restaurant/analytics")
async def get_restaurant_sales_analytics(
    current_restaurant: dict = Depends(get_current_restaurant)
):
    """
    Get sales analytics for restaurant dashboard.
    Returns: total sales, orders, weekly/monthly growth, daily sales data
    """
    db = get_database()
    restaurant_id = str(current_restaurant.get("_id"))

    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    one_month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)

    # ==================== TOTAL SALES & ORDERS ====================
    # Get all completed orders for this restaurant
    all_completed_orders = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "completed"
    }).to_list(None)

    total_orders = len(all_completed_orders)
    total_sales = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                      for order in all_completed_orders)

    # ==================== THIS WEEK VS LAST WEEK ====================
    orders_this_week = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "completed",
        "created_at": {"$gte": one_week_ago}
    }).to_list(None)

    orders_last_week = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "completed",
        "created_at": {"$gte": two_weeks_ago, "$lt": one_week_ago}
    }).to_list(None)

    orders_count_this_week = len(orders_this_week)
    orders_count_last_week = len(orders_last_week)

    sales_this_week = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                          for order in orders_this_week)
    sales_last_week = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                          for order in orders_last_week)

    # Calculate week growth
    if orders_count_last_week == 0:
        week_growth = 100.0 if orders_count_this_week > 0 else 0.0
    else:
        week_growth = ((orders_count_this_week - orders_count_last_week) / orders_count_last_week) * 100

    # ==================== THIS MONTH VS LAST MONTH ====================
    orders_this_month = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "completed",
        "created_at": {"$gte": one_month_ago}
    }).to_list(None)

    orders_last_month = await db.orders.find({
        "restaurant_id": restaurant_id,
        "status": "completed",
        "created_at": {"$gte": two_months_ago, "$lt": one_month_ago}
    }).to_list(None)

    orders_count_this_month = len(orders_this_month)
    orders_count_last_month = len(orders_last_month)

    sales_this_month = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                           for order in orders_this_month)
    sales_last_month = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                           for order in orders_last_month)

    # Calculate month growth
    if orders_count_last_month == 0:
        month_growth = 100.0 if orders_count_this_month > 0 else 0.0
    else:
        month_growth = ((orders_count_this_month - orders_count_last_month) / orders_count_last_month) * 100

    # ==================== DAILY SALES (Last 7 Days) ====================
    daily_sales: List[Dict] = []
    for i in range(6, -1, -1):  # Last 7 days
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        day_orders = await db.orders.find({
            "restaurant_id": restaurant_id,
            "status": "completed",
            "created_at": {"$gte": day_start, "$lt": day_end}
        }).to_list(None)

        day_sales = sum(order.get("total_price", 0) or order.get("price", 0) or 0
                       for order in day_orders)

        daily_sales.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "sales": float(day_sales),
            "orders": len(day_orders)
        })

    # ==================== BUILD RESPONSE ====================
    return {
        "total_sales": float(total_sales),
        "total_orders": total_orders,
        "week_growth": round(week_growth, 1),
        "month_growth": round(month_growth, 1),
        "orders_this_week": orders_count_this_week,
        "orders_this_month": orders_count_this_month,
        "orders_last_week": orders_count_last_week,
        "orders_last_month": orders_count_last_month,
        "sales_this_week": float(sales_this_week),
        "sales_this_month": float(sales_this_month),
        "sales_last_week": float(sales_last_week),
        "sales_last_month": float(sales_last_month),
        "daily_sales": daily_sales
    }
