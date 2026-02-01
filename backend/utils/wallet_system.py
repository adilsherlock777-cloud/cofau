# utils/wallet_system.py
"""
Cofau Wallet System
Handles wallet rewards for post uploads with validation checks.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from bson import ObjectId
import math

# Import create_notification - imported here to avoid circular imports
# This is safe because we only use it at runtime, not at module load time
def get_create_notification():
    from routers.notifications import create_notification
    return create_notification


# Wallet reward amounts
WALLET_REWARD_FULL = 10.0
WALLET_REWARD_REDUCED = 5.0
WALLET_FIRST_POST_BONUS = 50.0  # First post bonus for new users
POINTS_PER_POST = 25
LOCATION_RADIUS_KM = 1.0  # User must be within 1km of restaurant


class WalletRewardResult:
    """Result object for wallet reward calculation"""
    def __init__(
        self,
        wallet_earned: float = 0.0,
        points_earned: int = POINTS_PER_POST,
        reason: str = "",
        checks_passed: Dict[str, bool] = None,
        message: str = "",
        tip: str = ""
    ):
        self.wallet_earned = wallet_earned
        self.points_earned = points_earned
        self.reason = reason
        self.checks_passed = checks_passed or {}
        self.message = message
        self.tip = tip
    
    def to_dict(self):
        return {
            "wallet_earned": self.wallet_earned,
            "points_earned": self.points_earned,
            "reason": self.reason,
            "checks_passed": self.checks_passed,
            "message": self.message,
            "tip": self.tip
        }


def calculate_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates using Haversine formula.
    Returns distance in kilometers.
    """
    if not all([lat1, lon1, lat2, lon2]):
        return float('inf')  # Return infinite distance if any coordinate is missing

    R = 6371  # Earth's radius in kilometers

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = math.sin(delta_lat / 2) ** 2 + \
        math.cos(lat1_rad) * math.cos(lat2_rad) * \
        math.sin(delta_lon / 2) ** 2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


async def calculate_wallet_reward(
    db,
    user: dict,
    post_data: dict,
    user_latitude: float = None,
    user_longitude: float = None
) -> WalletRewardResult:
    """
    Calculate wallet reward for a post based on validation checks.

    Checks:
    1. First post? → ₹50 bonus (no other checks)
    2. Location valid (user near restaurant)?
    3. Already earned wallet today?
    4. Posted at this restaurant this week?
    5. Review meets quality (30+ chars)?

    Returns WalletRewardResult with earned amount and details.
    """

    user_id = str(user["_id"])

    # =========================================
    # CHECK 1: Is this user's FIRST POST EVER?
    # =========================================
    # Check this FIRST so new users always get their ₹50 bonus
    total_posts = await db.posts.count_documents({"user_id": user_id})
    print(f"🔍 First post check: user {user_id} has {total_posts} posts")

    # total_posts = 1 means this is their first post (post already inserted in DB before wallet calc)
    is_first_post = total_posts == 1

    if is_first_post:
        print(f"🎉 First post detected! Giving ₹{WALLET_FIRST_POST_BONUS} bonus")
        # First post bonus - no other checks required!
        return WalletRewardResult(
            wallet_earned=WALLET_FIRST_POST_BONUS,
            points_earned=POINTS_PER_POST,
            reason="first_post_bonus",
            checks_passed={"first_post": True},
            message="Welcome to Cofau! 🎉",
            tip=""
        )

    # =========================================
    # CHECK 0: Is wallet enabled for this user?
    # =========================================
    # For subsequent posts, check if wallet is enabled
    wallet_enabled = user.get("wallet_enabled", False)

    if not wallet_enabled:
        return WalletRewardResult(
            wallet_earned=0.0,
            points_earned=POINTS_PER_POST,
            reason="wallet_not_enabled",
            checks_passed={},
            message="Post Uploaded!",
            tip=""
        )

    # =========================================
    # From here, normal checks for subsequent posts
    # =========================================
    checks = {
        "location_valid": False,
        "not_earned_today": False,
        "not_posted_here_this_week": False,
        "quality_met": False,
    }

    # =========================================
    # CHECK 2: Location Valid (User near restaurant)
    # =========================================
    post_latitude = post_data.get("latitude")
    post_longitude = post_data.get("longitude")

    if user_latitude and user_longitude and post_latitude and post_longitude:
        distance = calculate_distance_km(
            user_latitude, user_longitude,
            post_latitude, post_longitude
        )
        checks["location_valid"] = distance <= LOCATION_RADIUS_KM

        if not checks["location_valid"]:
            return WalletRewardResult(
                wallet_earned=0.0,
                points_earned=POINTS_PER_POST,
                reason="location_not_valid",
                checks_passed=checks,
                message="Post Uploaded!",
                tip="Visit the restaurant to earn wallet rewards!"
            )
    else:
        # If location data missing, fail this check
        checks["location_valid"] = False
        return WalletRewardResult(
            wallet_earned=0.0,
            points_earned=POINTS_PER_POST,
            reason="location_missing",
            checks_passed=checks,
            message="Post Uploaded!",
            tip="Enable location to earn wallet rewards!"
        )

    # =========================================
    # CHECK 3: Already earned wallet today?
    # =========================================
    last_earn_date = user.get("last_wallet_earn_date")
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    if last_earn_date is None:
        checks["not_earned_today"] = True
    elif isinstance(last_earn_date, datetime):
        checks["not_earned_today"] = last_earn_date < today_start
    else:
        checks["not_earned_today"] = True

    if not checks["not_earned_today"]:
        return WalletRewardResult(
            wallet_earned=0.0,
            points_earned=POINTS_PER_POST,
            reason="already_earned_today",
            checks_passed=checks,
            message="Post Uploaded!",
            tip="You've earned today's wallet reward. Come back tomorrow!"
        )

    # =========================================
    # CHECK 4: Posted at this restaurant this week?
    # =========================================
    location_name = post_data.get("location_name", "").strip()
    tagged_restaurant_id = post_data.get("tagged_restaurant_id")
    location_identifier = tagged_restaurant_id or location_name

    if location_identifier:
        one_week_ago = datetime.utcnow() - timedelta(days=7)

        query = {
            "user_id": user_id,
            "created_at": {"$gte": one_week_ago}
        }

        if tagged_restaurant_id:
            query["restaurant_id"] = tagged_restaurant_id
        else:
            query["location_name"] = location_name

        recent_post = await db.user_restaurant_posts.find_one(query)
        checks["not_posted_here_this_week"] = recent_post is None
    else:
        checks["not_posted_here_this_week"] = True

    # =========================================
    # CHECK 5: Review quality (30+ chars)
    # =========================================
    review_text = post_data.get("review_text", "").strip()
    checks["quality_met"] = len(review_text) >= 30

    if not checks["quality_met"]:
        return WalletRewardResult(
            wallet_earned=0.0,
            points_earned=POINTS_PER_POST,
            reason="quality_not_met",
            checks_passed=checks,
            message="Post Uploaded!",
            tip="Write at least 30 characters to earn wallet rewards!"
        )

    # =========================================
    # ALL CHECKS PASSED - Calculate reward
    # =========================================
    if checks["not_posted_here_this_week"]:
        wallet_amount = WALLET_REWARD_FULL  # ₹10
    else:
        wallet_amount = WALLET_REWARD_REDUCED  # ₹5 for repeat

    return WalletRewardResult(
        wallet_earned=wallet_amount,
        points_earned=POINTS_PER_POST,
        reason="all_checks_passed",
        checks_passed=checks,
        message="Post Uploaded!",
        tip=""
    )


async def process_wallet_reward(
    db,
    user_id: str,
    reward_result: WalletRewardResult,
    post_id: str,
    location_name: str = None,
    restaurant_id: str = None
) -> dict:
    """
    Process the wallet reward:
    1. Update user's wallet_balance
    2. Update last_wallet_earn_date
    3. Create wallet_transaction record
    4. Create user_restaurant_posts record
    
    Returns updated wallet info.
    """
    
    if reward_result.wallet_earned <= 0:
        # No wallet reward, just return current balance
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        return {
            "wallet_balance": user.get("wallet_balance", 0.0),
            "amount_earned": 0.0,
            "transaction_id": None
        }
    
    # 1. Update user's wallet_balance and last_wallet_earn_date
    update_result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc": {"wallet_balance": reward_result.wallet_earned},
            "$set": {"last_wallet_earn_date": datetime.utcnow()}
        }
    )
    
    # 2. Create wallet transaction record
    transaction_doc = {
        "user_id": user_id,
        "amount": reward_result.wallet_earned,
        "type": "earned",
        "description": f"Posted at {location_name}" if location_name else "Posted review",
        "restaurant_id": restaurant_id,
        "post_id": post_id,
        "created_at": datetime.utcnow()
    }
    
    transaction_result = await db.wallet_transactions.insert_one(transaction_doc)
    
    # 3. Create user_restaurant_posts record (for weekly tracking)
    if location_name or restaurant_id:
        user_restaurant_doc = {
            "user_id": user_id,
            "restaurant_id": restaurant_id,
            "location_name": location_name,
            "post_id": post_id,
            "created_at": datetime.utcnow()
        }
        await db.user_restaurant_posts.insert_one(user_restaurant_doc)

    # 4. Send wallet reward notification to user
    try:
        create_notification = get_create_notification()
        # Format amount with rupee symbol
        amount_str = f"₹{int(reward_result.wallet_earned)}" if reward_result.wallet_earned == int(reward_result.wallet_earned) else f"₹{reward_result.wallet_earned:.1f}"
        notification_message = f"Congratulations! {amount_str} added to your wallet"

        await create_notification(
            db=db,
            notification_type="wallet_reward",
            from_user_id=user_id,  # User notifies themselves
            to_user_id=user_id,
            post_id=post_id,
            message=notification_message,
            send_push=True
        )
        print(f"🔔 Wallet reward notification sent: {notification_message}")
    except Exception as e:
        print(f"⚠️ Failed to send wallet reward notification: {e}")

    # 5. Get updated wallet balance
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})

    return {
        "wallet_balance": updated_user.get("wallet_balance", 0.0),
        "amount_earned": reward_result.wallet_earned,
        "transaction_id": str(transaction_result.inserted_id)
    }


async def get_wallet_info(db, user_id: str) -> dict:
    """
    Get user's wallet information including:
    - Current balance
    - Amount needed for Amazon voucher
    - Recent transactions
    - Delivery discount info
    """
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None
    
    wallet_balance = user.get("wallet_balance", 0.0)
    
    # Amazon voucher threshold
    AMAZON_VOUCHER_THRESHOLD = 1000.0
    amount_needed = max(0, AMAZON_VOUCHER_THRESHOLD - wallet_balance)
    
    # Delivery discount info
    DELIVERY_DISCOUNT_PER_ORDER = 25.0
    deliveries_worth = int(wallet_balance / DELIVERY_DISCOUNT_PER_ORDER)
    
    # Get recent transactions (last 10)
    transactions = await db.wallet_transactions.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    formatted_transactions = []
    for tx in transactions:
        created_at = tx.get("created_at")
        
        # Format date
        if isinstance(created_at, datetime):
            today = datetime.utcnow().date()
            yesterday = today - timedelta(days=1)
            tx_date = created_at.date()
            
            if tx_date == today:
                date_str = "Today"
            elif tx_date == yesterday:
                date_str = "Yesterday"
            else:
                date_str = created_at.strftime("%b %d")
        else:
            date_str = "Unknown"
        
        formatted_transactions.append({
            "id": str(tx["_id"]),
            "date": date_str,
            "amount": tx.get("amount", 0),
            "type": tx.get("type", "earned"),
            "description": tx.get("description", ""),
            "created_at": created_at.isoformat() if isinstance(created_at, datetime) else None
        })
    
    return {
        "balance": wallet_balance,
        "target_amount": AMAZON_VOUCHER_THRESHOLD,
        "amount_needed": amount_needed,
        "progress_percent": min((wallet_balance / AMAZON_VOUCHER_THRESHOLD) * 100, 100),
        "can_claim_voucher": wallet_balance >= AMAZON_VOUCHER_THRESHOLD,
        "delivery_discount": {
            "per_order": DELIVERY_DISCOUNT_PER_ORDER,
            "deliveries_worth": deliveries_worth
        },
        "recent_transactions": formatted_transactions
    }