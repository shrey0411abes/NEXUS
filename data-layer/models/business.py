"""Business domain model representing a merchant/organization."""
from datetime import datetime, timezone
from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.product import Product
    from models.transaction import Transaction
    from models.user import User
    from models.investigation import Investigation
    from models.risk_action import RiskAction


class Business(Base):
    """Represents a business or enterprise entity registered in NEXUS."""
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # 1 -> N Relationships
    products: Mapped[List["Product"]] = relationship(
        "Product",
        back_populates="business",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="business",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="business",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    investigations: Mapped[List["Investigation"]] = relationship(
        "Investigation",
        back_populates="business",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    risk_actions: Mapped[List["RiskAction"]] = relationship(
        "RiskAction",
        back_populates="business",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Business(id={self.id}, name='{self.name}', industry='{self.industry}')>"
