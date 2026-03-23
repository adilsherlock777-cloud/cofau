# routers/restaurant_referral.py
"""
Restaurant Referral / Invite System API endpoints.
Users can invite restaurants to Cofau and earn rewards when the restaurant is approved.
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from routers.admin_auth import get_current_admin
from routers.notifications import create_notification
from pydantic import BaseModel
from typing import Optional
import random
import string

router = APIRouter(prefix="/api/referral", tags=["Restaurant Referral"])


# ─── Helpers ───────────────────────────────────────────────

def generate_referral_code(username: str) -> str:
    """Generate a unique referral code like COFAU-username-XXXX"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"COFAU-{username.upper()}-{suffix}"


REWARD_PER_REFERRAL = 75
CLAIM_THRESHOLD = 5  # Must onboard 5 restaurants before claiming


# ─── User Endpoints ───────────────────────────────────────

@router.get("/info")
async def get_referral_info(current_user: dict = Depends(get_current_user)):
    """
    Get referral dashboard info for the current user.
    Returns referral code, balance, referral counts, and referral list.
    """
    if current_user.get("account_type") == "restaurant":
        raise HTTPException(status_code=400, detail="Referral not available for restaurant accounts")

    db = get_database()
    user_id = str(current_user["_id"])
    username = current_user.get("username", "user")

    # Get or create referral code
    referral_code = current_user.get("referral_code")
    if not referral_code:
        referral_code = generate_referral_code(username)
        # Ensure uniqueness
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = generate_referral_code(username)
        await db.users.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"referral_code": referral_code}}
        )

    # Get referral stats
    referrals = await db.restaurant_referrals.find(
        {"referrer_user_id": user_id}
    ).sort("created_at", -1).to_list(None)

    onboarded_count = sum(1 for r in referrals if r.get("status") == "approved")
    pending_count = sum(1 for r in referrals if r.get("status") == "pending_verification")
    request_sent_count = sum(1 for r in referrals if r.get("status") == "request_sent")
    rejected_count = sum(1 for r in referrals if r.get("status") == "rejected")

    # Referral wallet balance (separate from main wallet)
    referral_balance = current_user.get("referral_balance", 0)
    total_earned = onboarded_count * REWARD_PER_REFERRAL
    can_claim = onboarded_count >= CLAIM_THRESHOLD and referral_balance > 0

    # Progress: 0 to 10 scale (max 10 referrals on bar)
    progress_percent = min((referral_balance / (CLAIM_THRESHOLD * REWARD_PER_REFERRAL)) * 100, 100)
    target_amount = CLAIM_THRESHOLD * REWARD_PER_REFERRAL  # ₹375

    # Build referral list with restaurant info
    referral_list = []
    for ref in referrals:
        restaurant = None
        if ref.get("restaurant_id"):
            restaurant = await db.restaurants.find_one({"_id": ObjectId(ref["restaurant_id"])})

        referral_list.append({
            "id": str(ref["_id"]),
            "restaurant_name": restaurant.get("restaurant_name", "Unknown") if restaurant else ref.get("restaurant_name", "Unknown"),
            "status": ref.get("status", "request_sent"),
            "created_at": ref.get("created_at", datetime.utcnow()).isoformat(),
            "reward_amount": REWARD_PER_REFERRAL if ref.get("status") == "approved" else 0,
            "admin_message": ref.get("admin_message", ""),
        })

    return {
        "referral_code": referral_code,
        "referral_balance": referral_balance,
        "total_earned": total_earned,
        "onboarded_count": onboarded_count,
        "pending_count": pending_count,
        "request_sent_count": request_sent_count,
        "rejected_count": rejected_count,
        "can_claim": can_claim,
        "claim_threshold": CLAIM_THRESHOLD,
        "reward_per_referral": REWARD_PER_REFERRAL,
        "target_amount": target_amount,
        "progress_percent": progress_percent,
        "referrals": referral_list,
    }


@router.get("/validate-code/{code}")
async def validate_referral_code(code: str):
    """
    Validate a referral code during restaurant signup.
    Returns referrer info if valid.
    """
    db = get_database()
    code_upper = code.strip().upper()

    user = await db.users.find_one({"referral_code": code_upper})
    if not user:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    return {
        "valid": True,
        "referrer_name": user.get("full_name", "A Cofau User"),
        "referrer_username": user.get("username", ""),
        "referrer_profile_picture": user.get("profile_picture"),
    }


class ClaimRequest(BaseModel):
    email: str
    phone: str
    upi_id: str


@router.post("/claim")
async def claim_referral_reward(claim: ClaimRequest, current_user: dict = Depends(get_current_user)):
    """
    Claim referral rewards. User must have at least 5 approved referrals.
    """
    if current_user.get("account_type") == "restaurant":
        raise HTTPException(status_code=400, detail="Referral not available for restaurant accounts")

    db = get_database()
    user_id = str(current_user["_id"])

    referral_balance = current_user.get("referral_balance", 0)
    onboarded_count = await db.restaurant_referrals.count_documents({
        "referrer_user_id": user_id,
        "status": "approved"
    })

    if onboarded_count < CLAIM_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"You need at least {CLAIM_THRESHOLD} approved referrals to claim. You have {onboarded_count}."
        )

    if referral_balance <= 0:
        raise HTTPException(status_code=400, detail="No referral balance to claim")

    # Validate inputs
    if not claim.email.strip() or not claim.phone.strip() or not claim.upi_id.strip():
        raise HTTPException(status_code=400, detail="Please provide email, phone, and UPI ID")

    # Create claim record
    claim_doc = {
        "user_id": user_id,
        "username": current_user.get("username"),
        "full_name": current_user.get("full_name"),
        "email": claim.email.strip(),
        "phone": claim.phone.strip(),
        "upi_id": claim.upi_id.strip(),
        "amount": referral_balance,
        "claim_type": "restaurant_referral",
        "status": "pending",
        "created_at": datetime.utcnow(),
    }

    await db.referral_claims.insert_one(claim_doc)

    # Reset referral balance after claim
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"referral_balance": 0}}
    )

    return {
        "success": True,
        "message": f"Claim of ₹{referral_balance} submitted successfully! You'll receive it within 3-5 business days.",
        "amount_claimed": referral_balance,
    }


# ─── Admin Endpoints ──────────────────────────────────────

@router.get("/admin/pending-restaurants")
async def get_pending_restaurants(
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin)
):
    """
    Get restaurants pending verification (for admin portal).
    """
    db = get_database()

    pipeline = [
        {"$match": {"verification_status": {"$in": ["pending", None]}, "is_verified": False}},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
    ]

    restaurants = await db.restaurants.aggregate(pipeline).to_list(None)

    result = []
    for r in restaurants:
        # Check if this restaurant was referred by someone
        referral = await db.restaurant_referrals.find_one({
            "restaurant_id": str(r["_id"]),
            "status": {"$in": ["pending_verification", "request_sent"]}
        })

        referrer_info = None
        if referral:
            referrer = await db.users.find_one({"_id": ObjectId(referral["referrer_user_id"])})
            if referrer:
                referrer_info = {
                    "name": referrer.get("full_name", "Unknown"),
                    "username": referrer.get("username", ""),
                }

        result.append({
            "id": str(r["_id"]),
            "restaurant_name": r.get("restaurant_name", ""),
            "email": r.get("email", ""),
            "phone_number": r.get("phone_number", ""),
            "food_type": r.get("food_type", ""),
            "fssai_license_number": r.get("fssai_license_number", ""),
            "fssai_license_document": r.get("fssai_license_document", ""),
            "gst_number": r.get("gst_number", ""),
            "is_verified": r.get("is_verified", False),
            "created_at": r.get("created_at", datetime.utcnow()).isoformat(),
            "referred_by": referrer_info,
        })

    total = await db.restaurants.count_documents(
        {"verification_status": {"$in": ["pending", None]}, "is_verified": False}
    )

    return {"restaurants": result, "total": total}


class ApproveRejectRequest(BaseModel):
    action: str  # "approve" or "reject"
    message: Optional[str] = None


@router.post("/admin/restaurant/{restaurant_id}/review")
async def review_restaurant(
    restaurant_id: str,
    request: ApproveRejectRequest,
    current_admin: dict = Depends(get_current_admin)
):
    """
    Admin approves or rejects a restaurant. If approved and referred,
    credits the referrer's referral_balance with ₹75.
    Sends notifications to both the restaurant and referrer.
    """
    db = get_database()

    restaurant = await db.restaurants.find_one({"_id": ObjectId(restaurant_id)})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    action = request.action.lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    admin_message = request.message or ""

    if action == "approve":
        # Mark restaurant as verified
        await db.restaurants.update_one(
            {"_id": ObjectId(restaurant_id)},
            {"$set": {
                "is_verified": True,
                "verification_status": "approved",
                "verified_at": datetime.utcnow(),
                "verified_by": str(current_admin["_id"]),
            }}
        )

        # Send notification to restaurant
        await create_notification(
            db,
            notification_type="restaurant_approved",
            from_user_id=restaurant_id,  # self-notification
            to_user_id=restaurant_id,
            message="Congratulations! Your restaurant has been verified and approved on Cofau! You can now start posting.",
            send_push=True,
        )

        # Handle referral reward
        referral = await db.restaurant_referrals.find_one({
            "restaurant_id": restaurant_id,
            "status": {"$in": ["pending_verification", "request_sent"]}
        })

        if referral:
            referrer_user_id = referral["referrer_user_id"]

            # Update referral status
            await db.restaurant_referrals.update_one(
                {"_id": referral["_id"]},
                {"$set": {
                    "status": "approved",
                    "approved_at": datetime.utcnow(),
                    "admin_message": admin_message,
                }}
            )

            # Credit referrer's referral balance
            await db.users.update_one(
                {"_id": ObjectId(referrer_user_id)},
                {"$inc": {"referral_balance": REWARD_PER_REFERRAL}}
            )

            # Record referral transaction
            await db.referral_transactions.insert_one({
                "user_id": referrer_user_id,
                "restaurant_id": restaurant_id,
                "restaurant_name": restaurant.get("restaurant_name", ""),
                "amount": REWARD_PER_REFERRAL,
                "type": "referral_reward",
                "description": f"Reward for onboarding {restaurant.get('restaurant_name', 'a restaurant')}",
                "created_at": datetime.utcnow(),
            })

            # Notify referrer
            await create_notification(
                db,
                notification_type="referral_approved",
                from_user_id=referrer_user_id,  # self-notification
                to_user_id=referrer_user_id,
                message=f"Great news! {restaurant.get('restaurant_name', 'A restaurant')} you referred has been approved! ₹{REWARD_PER_REFERRAL} added to your referral balance.",
                send_push=True,
            )

        return {
            "success": True,
            "message": f"Restaurant '{restaurant.get('restaurant_name')}' approved successfully.",
            "referral_rewarded": referral is not None,
        }

    else:  # reject
        await db.restaurants.update_one(
            {"_id": ObjectId(restaurant_id)},
            {"$set": {
                "verification_status": "rejected",
                "rejection_message": admin_message,
                "rejected_at": datetime.utcnow(),
                "rejected_by": str(current_admin["_id"]),
            }}
        )

        # Notify restaurant
        reject_msg = f"Your restaurant verification was not approved."
        if admin_message:
            reject_msg += f" Reason: {admin_message}"

        await create_notification(
            db,
            notification_type="restaurant_rejected",
            from_user_id=restaurant_id,
            to_user_id=restaurant_id,
            message=reject_msg,
            send_push=True,
        )

        # Update referral if exists
        referral = await db.restaurant_referrals.find_one({
            "restaurant_id": restaurant_id,
            "status": {"$in": ["pending_verification", "request_sent"]}
        })

        if referral:
            referrer_user_id = referral["referrer_user_id"]

            await db.restaurant_referrals.update_one(
                {"_id": referral["_id"]},
                {"$set": {
                    "status": "rejected",
                    "rejected_at": datetime.utcnow(),
                    "admin_message": admin_message,
                }}
            )

            # Notify referrer about rejection
            referrer_msg = f"The restaurant '{restaurant.get('restaurant_name', '')}' you referred was not approved."
            if admin_message:
                referrer_msg += f" Reason: {admin_message}"

            await create_notification(
                db,
                notification_type="referral_rejected",
                from_user_id=referrer_user_id,
                to_user_id=referrer_user_id,
                message=referrer_msg,
                send_push=True,
            )

        return {
            "success": True,
            "message": f"Restaurant '{restaurant.get('restaurant_name')}' rejected.",
        }


@router.get("/admin/referral-claims")
async def get_referral_claims(
    status_filter: str = "all",
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin)
):
    """Get referral claim requests for admin processing."""
    db = get_database()

    query = {}
    if status_filter != "all":
        query["status"] = status_filter

    claims = await db.referral_claims.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(None)

    result = []
    for c in claims:
        result.append({
            "id": str(c["_id"]),
            "username": c.get("username"),
            "full_name": c.get("full_name"),
            "email": c.get("email"),
            "phone": c.get("phone"),
            "upi_id": c.get("upi_id"),
            "amount": c.get("amount"),
            "status": c.get("status"),
            "created_at": c.get("created_at", datetime.utcnow()).isoformat(),
        })

    return {"claims": result}
