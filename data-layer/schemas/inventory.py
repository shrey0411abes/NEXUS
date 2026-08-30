"""Pydantic schemas for Inventory entity."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InventoryBase(BaseModel):
    quantity: int = Field(default=0, ge=0, description="Available stock quantity")
    reorder_level: int = Field(default=10, ge=0, description="Minimum stock threshold for reorder alerts")


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = Field(None, ge=0, description="Updated stock quantity")
    reorder_level: Optional[int] = Field(None, ge=0, description="Updated reorder threshold")


class InventoryResponse(InventoryBase):
    id: int
    product_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
