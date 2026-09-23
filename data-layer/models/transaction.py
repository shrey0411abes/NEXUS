"""Transaction and TransactionItem domain models."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, DateTime, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.business import Business
    from models.product import Product


class Transaction(Base):
    """Represents a completed business transaction record (sale, purchase, etc.)."""
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    __table_args__ = (
        Index("ix_transactions_business_date_type", "business_id", "transaction_date", "transaction_type"),
        CheckConstraint("total_amount >= 0", name="chk_transaction_total_amount"),
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="transactions"
    )
    items: Mapped[List["TransactionItem"]] = relationship(
        "TransactionItem",
        back_populates="transaction",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, business_id={self.business_id}, type='{self.transaction_type}', amount={self.total_amount})>"


class TransactionItem(Base):
    """Represents an individual line item contained within a Transaction."""
    __tablename__ = "transaction_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("transactions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_transaction_item_quantity"),
        CheckConstraint("unit_price >= 0", name="chk_transaction_item_unit_price"),
    )

    # Relationships
    transaction: Mapped["Transaction"] = relationship(
        "Transaction",
        back_populates="items"
    )
    product: Mapped["Product"] = relationship(
        "Product",
        back_populates="transaction_items",
        lazy="joined"
    )

    def __repr__(self) -> str:
        return f"<TransactionItem(id={self.id}, tx_id={self.transaction_id}, product_id={self.product_id}, qty={self.quantity}, price={self.unit_price})>"
