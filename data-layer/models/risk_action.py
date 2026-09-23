"""RiskAction domain model representing operational risk actioning and state transition audit logs."""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import Integer, String, DateTime, ForeignKey, Index, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.business import Business
    from models.user import User
    from models.product import Product


class RiskAction(Base):
    """
    Represents an immutable, tenant-isolated audit log entry for operational risk actions.

    Tracks state transitions (OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED) for deterministic
    risk fingerprints, recording actor metadata, reason notes, and point-in-time metrics.
    """
    __tablename__ = "risk_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    product_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    risk_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    risk_category: Mapped[str] = mapped_column(String(50), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False)
    action_note: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    metrics_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "state IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')",
            name="chk_risk_action_state",
        ),
        Index("ix_risk_actions_biz_fp_created", "business_id", "risk_fingerprint", "created_at"),
        Index("ix_risk_actions_biz_state", "business_id", "state"),
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="risk_actions")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="risk_actions")
    product: Mapped[Optional["Product"]] = relationship("Product")

    @property
    def user_email(self) -> Optional[str]:
        """Convenience property exposing actor user email for audit serialization."""
        return self.user.email if self.user else None

    def __repr__(self) -> str:
        return (
            f"<RiskAction(id={self.id}, business_id={self.business_id}, "
            f"fingerprint='{self.risk_fingerprint}', state='{self.state}', user_id={self.user_id})>"
        )
