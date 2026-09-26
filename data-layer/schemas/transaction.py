"""Pydantic schemas for Transaction and TransactionItem entities."""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, List, Optional, Sequence
from pydantic import BaseModel, ConfigDict, Field, field_serializer


def calculate_transaction_total(items: Sequence[Any]) -> Decimal:
    """
    Canonical server authority for transaction total calculation.
    Uses exact Decimal arithmetic and ROUND_HALF_UP quantization to 2 decimal places.
    """
    raw_total = sum(
        (Decimal(str(item.quantity)) * Decimal(str(item.unit_price)) for item in items),
        Decimal("0.00")
    )
    return raw_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class TransactionItemBase(BaseModel):
    product_id: int = Field(..., description="ID of the purchased/sold product")
    quantity: int = Field(..., gt=0, description="Quantity of items")
    unit_price: Decimal = Field(..., ge=Decimal("0.0"), decimal_places=2, description="Unit price at the time of transaction")

    @field_serializer("unit_price", when_used="json-unless-none")
    def serialize_unit_price(self, v: Decimal) -> float:
        return float(v)


class TransactionItemCreate(TransactionItemBase):
    pass


class TransactionItemResponse(TransactionItemBase):
    id: int
    transaction_id: int

    model_config = ConfigDict(from_attributes=True)


class TransactionBase(BaseModel):
    business_id: int = Field(..., description="Foreign key ID of the business")
    transaction_type: str = Field(..., description="Type of transaction (e.g. sale, purchase, refund)")
    total_amount: Optional[Decimal] = Field(None, ge=Decimal("0.0"), decimal_places=2, description="Total amount. Calculated from items if omitted.")

    @field_serializer("total_amount", when_used="json-unless-none")
    def serialize_total_amount(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class TransactionCreate(TransactionBase):
    items: List[TransactionItemCreate] = Field(default_factory=list, description="Line items in this transaction")


class TransactionResponse(BaseModel):
    id: int
    business_id: int
    transaction_type: str
    total_amount: Decimal
    transaction_date: datetime
    created_at: datetime
    items: List[TransactionItemResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("total_amount", when_used="json-unless-none")
    def serialize_total_amount(self, v: Decimal) -> float:
        return float(v)
