"""Repository for User persistence operations."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from models.user import User


class UserRepository:
    """Encapsulates database operations for User entities."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: int) -> Optional[User]:
        """Retrieve a user by primary key."""
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> Optional[User]:
        """Retrieve a user by normalized email address."""
        normalized_email = email.strip().lower()
        stmt = select(User).where(User.email == normalized_email)
        return self.db.scalars(stmt).first()

    def get_all_by_business(self, business_id: int) -> List[User]:
        """Retrieve all users associated with a specific business tenant."""
        stmt = select(User).where(User.business_id == business_id).order_by(User.id.asc())
        return list(self.db.scalars(stmt).all())

    def create(
        self,
        business_id: int,
        email: str,
        password_hash: str,
        role: str = "OWNER",
    ) -> User:
        """Create and stage a new user record for an existing business on the session."""
        normalized_email = email.strip().lower()
        user = User(
            business_id=business_id,
            email=normalized_email,
            password_hash=password_hash,
            role=role,
            is_active=True,
        )
        try:
            self.db.add(user)
            self.db.flush()
            self.db.refresh(user)
            return user
        except Exception:
            self.db.rollback()
            raise
