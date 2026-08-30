"""Pydantic schemas for Transaction and TransactionItem entities."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TransactionItemBase(BaseModel):
    product_id: int = Field(..., description="ID of the purchased/sold product")
    quantity: int = Field(..., gt=0, description="Quantity of items")
    unit_price: float = Field(..., ge=0.0, description="Unit price at the time of transaction")


class TransactionItemCreate(TransactionItemBase):
    pass


class TransactionItemResponse(TransactionItemBase):
    id: int
    transaction_id: int

    model_config = ConfigDict(from_attributes=True)


class TransactionBase(BaseModel):
    business_id: int = Field(..., description="Foreign key ID of the business")
    transaction_type: str = Field(..., description="Type of transaction (e.g. sale, purchase, refund)")
    total_amount: Optional[float] = Field(None, ge=0.0, description="Total amount. Calculated from items if omitted.")


class TransactionCreate(TransactionBase):
    items: List[TransactionItemCreate] = Field(default_factory=list, description="Line items in this transaction")


class TransactionResponse(BaseModel):
    id: int
    business_id: int
    transaction_type: str
    total_amount: float
    transaction_date: datetime
    created_at: datetime
    items: List[TransactionItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
