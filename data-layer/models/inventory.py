"""Inventory domain model representing product stock tracking."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Integer, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.product import Product


class Inventory(Base):
    """Represents real-time stock levels and threshold alerts for a product."""
    __tablename__ = "inventories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="chk_inventory_quantity"),
        CheckConstraint("reorder_level >= 0", name="chk_inventory_reorder_level"),
    )

    # 1 -> 1 Relationship
    product: Mapped["Product"] = relationship(
        "Product",
        back_populates="inventory"
    )

    def __repr__(self) -> str:
        return f"<Inventory(id={self.id}, product_id={self.product_id}, qty={self.quantity}, reorder={self.reorder_level})>"
