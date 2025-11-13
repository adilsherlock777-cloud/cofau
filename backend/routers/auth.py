from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import datetime
from database import get_database
from models.user import UserCreate, UserLogin, Token, UserResponse
from utils.hashing import hash_password, verify_password
from utils.jwt import create_access_token, verify_token
from utils.level_system import calculate_level

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current authenticated user"""
    email = verify_token(token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    db = get_database()
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.post("/signup", response_model=Token)
async def signup(user: UserCreate):
    """Register a new user"""
    db = get_database()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user.password)
    
    # Create user document with default level & points
    user_doc = {
        "full_name": user.full_name,
        "email": user.email,
        "password_hash": hashed_password,
        "profile_picture": None,
        "bio": None,
        "total_points": 0,  # Total accumulated points
        "points": 0,  # For backward compatibility
        "level": 1,
        "currentPoints": 0,
        "requiredPoints": 1250,
        "title": "Reviewer",
        "badge": None,
        "followers_count": 0,
        "following_count": 0,
        "created_at": datetime.utcnow()
    }
    
    # Insert user
    result = await db.users.insert_one(user_doc)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login user"""
    db = get_database()
    
    # Find user
    user = await db.users.find_one({"email": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user["email"]})
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/forgot-password")
async def forgot_password(email: str):
    """Send OTP for password reset (dummy implementation)"""
    db = get_database()
    
    user = await db.users.find_one({"email": email})
    if not user:
        # Don't reveal if email exists
        return {"message": "If email exists, OTP has been sent"}
    
    # In production, send actual OTP via email
    # For now, just return success message
    return {"message": "OTP sent to email", "otp": "123456"}

@router.post("/verify-otp")
async def verify_otp(email: str, otp: str):
    """Verify OTP (dummy implementation)"""
    # In production, verify actual OTP from database
    if otp == "123456":
        return {"message": "OTP verified successfully"}
    else:
        raise HTTPException(status_code=400, detail="Invalid OTP")

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": str(current_user["_id"]),
        "full_name": current_user["full_name"],
        "email": current_user["email"],
        "profile_picture": current_user.get("profile_picture"),
        "bio": current_user.get("bio"),
        "points": current_user.get("points", 0),
        "level": current_user.get("level", 1),
        "currentPoints": current_user.get("currentPoints", 0),
        "requiredPoints": current_user.get("requiredPoints", 1250),
        "title": current_user.get("title", "Reviewer"),
        "badge": current_user.get("badge"),
        "followers_count": current_user.get("followers_count", 0),
        "following_count": current_user.get("following_count", 0),
        "created_at": current_user["created_at"]
    }
