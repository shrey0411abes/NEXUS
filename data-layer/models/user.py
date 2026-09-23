"""User domain model representing an authenticated operator within a business tenant."""
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.business import Business
    from models.investigation import Investigation
    from models.risk_action import RiskAction


class User(Base):
    """Represents an authenticated user belonging to a specific business tenant."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="OWNER",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("role IN ('OWNER', 'ADMIN', 'MEMBER')", name="chk_user_role"),
    )

    # Relationships
    business: Mapped["Business"] = relationship(
        "Business",
        back_populates="users",
    )
    investigations: Mapped[list["Investigation"]] = relationship(
        "Investigation",
        back_populates="user",
        lazy="selectin",
    )
    risk_actions: Mapped[list["RiskAction"]] = relationship(
        "RiskAction",
        back_populates="user",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', business_id={self.business_id}, role='{self.role}', active={self.is_active})>"

