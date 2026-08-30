"""Repository for Business persistence operations."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.business import Business
from schemas.business import BusinessCreate


class BusinessRepository:
    """Encapsulates database operations for Business entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_all(self, limit: int = 100, offset: int = 0) -> List[Business]:
        """Retrieve all businesses with pagination."""
        stmt = select(Business).order_by(Business.id.asc()).offset(offset).limit(limit)
        return list(self.db.scalars(stmt).all())

    def get_by_id(self, business_id: int) -> Optional[Business]:
        """Retrieve a single business by primary key."""
        return self.db.get(Business, business_id)

    def create(self, business_in: BusinessCreate) -> Business:
        """Create and persist a new business entity."""
        business = Business(
            name=business_in.name,
            industry=business_in.industry
        )
        try:
            self.db.add(business)
            self.db.commit()
            self.db.refresh(business)
            return business
        except Exception:
            self.db.rollback()
            raise
