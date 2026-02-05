from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional
from config import settings

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        account_type = payload.get("account_type")
        print(f"   🔓 Token decoded - email: {email}, account_type: {account_type}")
        if email is None:
            print(f"   ⚠️ Token payload missing 'sub' field")
            return None
        return email
    except JWTError as e:
        print(f"   ❌ JWT decode error: {str(e)}")
        return None
    except Exception as e:
        print(f"   ❌ Unexpected error in verify_token: {str(e)}")
        return None
        
def decode_access_token(token: str):
    """
    Decode JWT access token and return the payload.
    Returns the payload containing 'sub' (email) and other claims.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise ValueError("Invalid token")
