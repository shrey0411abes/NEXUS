"""Repository for Investigation audit persistence operations."""
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.investigation import Investigation


class InvestigationRepository:
    """Encapsulates database operations for Investigation audit entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, investigation_id: int) -> Optional[Investigation]:
        """Retrieve a single investigation by primary key."""
        return self.db.get(Investigation, investigation_id)

    def get_for_business(self, investigation_id: int, business_id: int) -> Optional[Investigation]:
        """Retrieve an investigation by ID strictly scoped to a specific business tenant."""
        stmt = select(Investigation).where(
            Investigation.id == investigation_id,
            Investigation.business_id == business_id,
        )
        return self.db.scalars(stmt).first()

    def get_all_for_business(
        self,
        business_id: int,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Investigation]:
        """Retrieve investigations strictly scoped to a specific business tenant."""
        stmt = (
            select(Investigation)
            .where(Investigation.business_id == business_id)
            .order_by(Investigation.created_at.desc(), Investigation.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def create(
        self,
        business_id: int,
        question: str,
        answer: str,
        confidence: str,
        verification_status: str,
        context_snapshot: Dict[str, Any],
        provider: str,
        execution_duration_ms: float,
        user_id: Optional[int] = None,
    ) -> Investigation:
        """Stage and persist a new investigation audit record."""
        investigation = Investigation(
            business_id=business_id,
            user_id=user_id,
            question=question,
            answer=answer,
            confidence=confidence,
            verification_status=verification_status,
            context_snapshot=context_snapshot,
            provider=provider,
            execution_duration_ms=execution_duration_ms,
        )
        self.db.add(investigation)
        self.db.flush()
        self.db.refresh(investigation)
        return investigation
