"""Pydantic schemas for Product entity."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from schemas.inventory import InventoryResponse


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Product catalog name")
    category: str = Field(..., min_length=1, max_length=100, description="Product category")
    sku: str = Field(..., min_length=1, max_length=100, description="Unique Stock Keeping Unit code")
    unit_price: float = Field(..., ge=0.0, description="Unit price in currency units")


class ProductCreate(ProductBase):
    business_id: int = Field(..., description="Foreign key ID of the owning business")
    initial_quantity: int = Field(default=0, ge=0, description="Initial inventory count")
    reorder_level: int = Field(default=10, ge=0, description="Initial reorder threshold")


class ProductResponse(ProductBase):
    id: int
    business_id: int
    created_at: datetime
    inventory: Optional[InventoryResponse] = None

    model_config = ConfigDict(from_attributes=True)
