# routers/wallet.py
"""
Wallet API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from bson import ObjectId
from database import get_database
from routers.auth import get_current_user
from utils.wallet_system import get_wallet_info

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])


@router.get("/balance")
async def get_wallet_balance(current_user: dict = Depends(get_current_user)):
    """
    Get current user's wallet balance and info.
    Returns balance, progress to Amazon voucher, delivery discount info, and recent transactions.
    """
    
    # Only for regular users, not restaurants
    if current_user.get("account_type") == "restaurant":
        raise HTTPException(status_code=400, detail="Wallet not available for restaurant accounts")
    
    db = get_database()
    user_id = str(current_user["_id"])
    
    wallet_info = await get_wallet_info(db, user_id)
    
    if not wallet_info:
        raise HTTPException(status_code=404, detail="User not found")
    
    return wallet_info


@router.get("/transactions")
async def get_wallet_transactions(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's wallet transaction history with pagination.
    """
    
    if current_user.get("account_type") == "restaurant":
        raise HTTPException(status_code=400, detail="Wallet not available for restaurant accounts")
    
    db = get_database()
    user_id = str(current_user["_id"])
    
    # Get total count
    total_count = await db.wallet_transactions.count_documents({"user_id": user_id})
    
    # Get transactions with pagination
    transactions = await db.wallet_transactions.find(
        {"user_id": user_id}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    formatted = []
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
        
        formatted.append({
            "id": str(tx["_id"]),
            "date": date_str,
            "amount": tx.get("amount", 0),
            "type": tx.get("type", "earned"),
            "description": tx.get("description", ""),
            "post_id": tx.get("post_id"),
            "created_at": created_at.isoformat() if isinstance(created_at, datetime) else None
        })
    
    return {
        "transactions": formatted,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }


@router.post("/redeem/delivery")
async def redeem_for_delivery(current_user: dict = Depends(get_current_user)):
    """
    Mark wallet balance as used for delivery discount.
    (Placeholder for future integration with delivery service)
    """
    
    if current_user.get("account_type") == "restaurant":
        raise HTTPException(status_code=400, detail="Wallet not available for restaurant accounts")
    
    db = get_database()
    user_id = str(current_user["_id"])
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    wallet_balance = user.get("wallet_balance", 0.0)
    
    if wallet_balance < 25:
        raise HTTPException(status_code=400, detail="Insufficient balance. Minimum ₹25 required.")
    
    # For now, just return info. Actual redemption will be implemented later.
    return {
        "message": "Delivery discount feature coming soon!",
        "current_balance": wallet_balance,
        "discount_available": min(wallet_balance, 25)
    }


@router.get("/unread-count")
async def get_unread_wallet_count(current_user: dict = Depends(get_current_user)):
    """
    Get count of unread wallet notifications (new transactions since last viewed).
    """

    if current_user.get("account_type") == "restaurant":
        return {"unread_count": 0}

    db = get_database()
    user_id = str(current_user["_id"])

    # Get last viewed timestamp (default to 7 days ago if never viewed)
    last_viewed = current_user.get("last_wallet_viewed")
    if not last_viewed:
        # Show transactions from last 7 days for first time users
        last_viewed = datetime.utcnow() - timedelta(days=7)

    # Count transactions since last viewed
    unread_count = await db.wallet_transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gt": last_viewed}
    })

    return {"unread_count": unread_count}


@router.post("/mark-viewed")
async def mark_wallet_viewed(current_user: dict = Depends(get_current_user)):
    """
    Mark wallet as viewed (updates last_wallet_viewed timestamp).
    Call this when user opens the wallet modal.
    """

    if current_user.get("account_type") == "restaurant":
        return {"success": True}

    db = get_database()

    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"last_wallet_viewed": datetime.utcnow()}}
    )

    return {"success": True}