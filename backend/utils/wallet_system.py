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
WALLET_REWARD_PER_POST = 10.0  # ₹10 per post (max 3 per week)
WALLET_FIRST_POST_BONUS = 25.0  # First post bonus for new users
POINTS_PER_POST = 25
MAX_REWARDED_POSTS_PER_WEEK = 3  # Only first 3 posts per week earn rewards
AMAZON_VOUCHER_THRESHOLD = 500.0  # Threshold to claim Amazon voucher

# Milestone progression: user must complete each level before moving to next
# After 250, jumps to 500 (Amazon voucher)
MILESTONES = [100, 125, 150, 175, 200, 225, 250, 500]


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
    Calculate wallet reward for a post.

    Rules:
    1. First post ever → ₹50 bonus (no other checks)
    2. Subsequent posts → ₹10 per post, max 2 rewarded posts per week
    3. 3rd, 4th, 5th+ posts in a week → ₹0

    Returns WalletRewardResult with earned amount and details.
    """

    user_id = str(user["_id"])

    # =========================================
    # CHECK 1: Is this user's FIRST POST EVER?
    # =========================================
    # Use wallet_transactions history instead of post count to prevent
    # users from deleting all posts and re-claiming the first post bonus
    has_any_wallet_history = await db.wallet_transactions.count_documents({"user_id": user_id, "type": "earned"})
    print(f"🔍 First post check: user {user_id} has {has_any_wallet_history} wallet transactions")

    is_first_post = has_any_wallet_history == 0

    if is_first_post:
        print(f"🎉 First post detected! Giving ₹{WALLET_FIRST_POST_BONUS} bonus")
        return WalletRewardResult(
            wallet_earned=WALLET_FIRST_POST_BONUS,
            points_earned=POINTS_PER_POST,
            reason="first_post_bonus",
            checks_passed={"first_post": True},
            message="Welcome to Cofau! 🎉",
            tip=""
        )

    # =========================================
    # CHECK 2: Is wallet enabled for this user?
    # =========================================
    wallet_enabled = user.get("wallet_enabled", True)

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
    # CHECK 3: How many rewarded posts this week?
    # =========================================
    # Count wallet transactions for posts this week (not including first post bonus)
    now = datetime.utcnow()
    # Get start of current week (Monday)
    days_since_monday = now.weekday()
    week_start = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)

    rewarded_posts_this_week = await db.wallet_transactions.count_documents({
        "user_id": user_id,
        "type": "earned",
        "created_at": {"$gte": week_start},
        "description": {"$not": {"$regex": "first post|First Post|Rank #1", "$options": "i"}}
    })

    print(f"📊 User {user_id} has {rewarded_posts_this_week} rewarded posts this week (max {MAX_REWARDED_POSTS_PER_WEEK})")

    if rewarded_posts_this_week >= MAX_REWARDED_POSTS_PER_WEEK:
        return WalletRewardResult(
            wallet_earned=0.0,
            points_earned=POINTS_PER_POST,
            reason="weekly_limit_reached",
            checks_passed={"weekly_limit_reached": True},
            message="Post Uploaded!",
            tip="You've earned your max rewards this week. Post again next week to earn more!"
        )

    # =========================================
    # ALL CHECKS PASSED - Give ₹10 reward
    # =========================================
    return WalletRewardResult(
        wallet_earned=WALLET_REWARD_PER_POST,
        points_earned=POINTS_PER_POST,
        reason="post_reward",
        checks_passed={"weekly_posts": rewarded_posts_this_week + 1},
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
    new_balance = updated_user.get("wallet_balance", 0.0)

    # 6. Check if user just reached a milestone — send congratulations notification
    try:
        claims_count = await db.voucher_claims.count_documents({"user_id": user_id})
        milestone_info = get_current_milestone(claims_count)
        current_target = milestone_info["target_amount"]
        old_balance = new_balance - reward_result.wallet_earned

        if old_balance < current_target <= new_balance:
            create_notification = get_create_notification()
            if milestone_info["is_amazon_voucher"]:
                milestone_msg = f"You've reached ₹{int(current_target)}! Claim your Amazon voucher now!"
            else:
                milestone_msg = f"You've reached ₹{int(current_target)}! Claim your reward now!"

            await create_notification(
                db=db,
                notification_type="milestone_reached",
                from_user_id=user_id,
                to_user_id=user_id,
                post_id=post_id,
                message=milestone_msg,
                send_push=True
            )
            print(f"🎯 Milestone notification sent: {milestone_msg}")
    except Exception as e:
        print(f"⚠️ Failed to send milestone notification: {e}")

    return {
        "wallet_balance": new_balance,
        "amount_earned": reward_result.wallet_earned,
        "transaction_id": str(transaction_result.inserted_id)
    }


def get_current_milestone(claims_count: int) -> dict:
    """
    Determine the current milestone target based on how many claims the user has completed.
    Returns dict with target_amount, milestone_index, and is_amazon_voucher.
    """
    if claims_count < len(MILESTONES):
        idx = claims_count
    else:
        # After completing all milestones, stay at 500 (Amazon voucher) forever
        idx = len(MILESTONES) - 1

    target = MILESTONES[idx]
    is_amazon = (target == 500)

    return {
        "target_amount": float(target),
        "milestone_index": idx,
        "is_amazon_voucher": is_amazon,
    }


async def get_wallet_info(db, user_id: str) -> dict:
    """
    Get user's wallet information including:
    - Current balance
    - Current milestone target (progressive: 100 → 125 → ... → 250 → 500)
    - Amount needed for current milestone
    - Recent transactions
    """

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return None

    wallet_balance = user.get("wallet_balance", 0.0)

    # Count completed milestone/voucher claims to determine current target
    claims_count = await db.voucher_claims.count_documents({"user_id": user_id})
    milestone_info = get_current_milestone(claims_count)
    current_target = milestone_info["target_amount"]

    amount_needed = max(0, current_target - wallet_balance)
    progress_percent = min((wallet_balance / current_target) * 100, 100) if current_target > 0 else 0

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
        "target_amount": current_target,
        "amount_needed": amount_needed,
        "progress_percent": progress_percent,
        "can_claim": wallet_balance >= current_target,
        "is_amazon_voucher": milestone_info["is_amazon_voucher"],
        "milestone_index": milestone_info["milestone_index"],
        "recent_transactions": formatted_transactions
    }