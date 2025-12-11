from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    # MongoDB
    MONGO_URL: str = os.getenv("MONGO_URL", "mongodb+srv://moinmisba92:quickSell%40121@quicksellify.mdhrm.mongodb.net/quickSellify?retryWrites=true&w=majority&appName=quickSellify")
    DATABASE_NAME: str = "cofau_db"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production-12345678"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # File Upload
    UPLOAD_DIR: str = "/root/cofau/backend/static/uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "mp4", "mov"}
    
    # Backend URL (for constructing absolute URLs)
    # For local development: http://localhost:8000
    # For production: https://backend.cofau.com
    BACKEND_URL: str = os.getenv("BACKEND_URL", "https://backend.cofau.com")
    
    # Sightengine API for content moderation
    SIGHTENGINE_API_USER: str = os.getenv("SIGHTENGINE_API_USER", "144214407")
    SIGHTENGINE_API_SECRET: str = os.getenv("SIGHTENGINE_API_SECRET", "JYA4RySafgQeKMUqnNGiQcdBFBuTKDk9")
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
