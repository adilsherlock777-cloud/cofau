from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class MenuItem(BaseModel):
    """Single menu item extracted from image"""
    name: str = Field(..., description="Name of the menu item")
    price: Optional[float] = Field(None, description="Price in ₹")
    category: Optional[str] = Field(None, description="Category (e.g., Main Course, Desserts)")
    description: Optional[str] = Field(None, description="Item description if available")
    confidence: float = Field(..., description="Confidence score (0-1)")
    needs_review: bool = Field(..., description="Whether item needs manual review")

class MenuExtractionRequest(BaseModel):
    """Request model for menu extraction from images"""
    image_urls: List[str] = Field(..., description="URLs of menu images to process")

class MenuExtractionResponse(BaseModel):
    """Response from AI menu extraction"""
    items: List[MenuItem]
    total_items: int
    needs_review_count: int
    extraction_id: str

class MenuItemUpdate(BaseModel):
    """Update model for correcting extracted menu items"""
    name: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    needs_review: Optional[bool] = None

class MenuItemDB(BaseModel):
    """Database model for menu items"""
    id: str
    restaurant_id: str
    name: str
    price: Optional[float]
    category: Optional[str]
    description: Optional[str]
    confidence: float
    needs_review: bool
    status: str = Field(default="pending", description="pending, approved, rejected")
    image_url: Optional[str] = None
    extraction_id: str
    created_at: datetime
    updated_at: datetime

class PublishMenuRequest(BaseModel):
    """Request to publish menu items"""
    item_ids: List[str] = Field(..., description="IDs of items to publish")

class MenuResponse(BaseModel):
    """Public menu response"""
    restaurant_id: str
    restaurant_name: str
    items: List[MenuItemDB]
    total_items: int
    categories: List[str]
    last_updated: datetime
