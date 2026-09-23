"""Investigation domain model representing an audit record of an AI business investigation."""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import Integer, String, Text, Float, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

if TYPE_CHECKING:
    from models.business import Business
    from models.user import User


class Investigation(Base):
    """
    Represents an immutable, tenant-isolated audit log of an executed business investigation.

    Downstream observability artifact capturing the question, output, confidence,
    verification status, and deterministic context snapshot.
    """
    __tablename__ = "investigations"

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
    question: Mapped[str] = mapped_column(String(2000), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[str] = mapped_column(String(20), nullable=False)
    verification_status: Mapped[str] = mapped_column(String(20), nullable=False)
    context_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    execution_duration_ms: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_investigations_business_created", "business_id", "created_at"),
    )

    # Relationships
    business: Mapped["Business"] = relationship("Business", back_populates="investigations")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="investigations")

    def __repr__(self) -> str:
        return (
            f"<Investigation(id={self.id}, business_id={self.business_id}, "
            f"user_id={self.user_id}, confidence='{self.confidence}', "
            f"status='{self.verification_status}', provider='{self.provider}')>"
        )
