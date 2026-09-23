"""Unit of Work pattern implementation for the NEXUS Data Layer."""
from abc import ABC, abstractmethod
from typing import Generator
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from repositories.business_repository import BusinessRepository
from repositories.inventory_repository import InventoryRepository
from repositories.product_repository import ProductRepository
from repositories.transaction_repository import TransactionRepository
from repositories.user_repository import UserRepository
from repositories.investigation_repository import InvestigationRepository
from repositories.risk_action_repository import RiskActionRepository


class AbstractUnitOfWork(ABC):
    """Abstract interface defining the Unit of Work contract."""
    businesses: BusinessRepository
    users: UserRepository
    products: ProductRepository
    inventory: InventoryRepository
    transactions: TransactionRepository
    investigations: InvestigationRepository
    risk_actions: RiskActionRepository

    def __enter__(self) -> "AbstractUnitOfWork":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()

    @abstractmethod
    def commit(self) -> None:
        """Commit the current transaction."""
        raise NotImplementedError

    @abstractmethod
    def rollback(self) -> None:
        """Rollback the current transaction."""
        raise NotImplementedError


class SqlAlchemyUnitOfWork(AbstractUnitOfWork):
    """
    SQLAlchemy-backed Unit of Work.
    Owns the database session and transaction lifecycle for application services.
    """

    def __init__(self, session: Session) -> None:
        self.db = session
        self.businesses = BusinessRepository(self.db)
        self.users = UserRepository(self.db)
        self.products = ProductRepository(self.db)
        self.inventory = InventoryRepository(self.db)
        self.transactions = TransactionRepository(self.db)
        self.investigations = InvestigationRepository(self.db)
        self.risk_actions = RiskActionRepository(self.db)
        self._committed = False


    def __enter__(self) -> "SqlAlchemyUnitOfWork":
        self._committed = False
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.rollback()
        else:
            if not self._committed:
                self.commit()

    def commit(self) -> None:
        """Explicitly commit the transaction."""
        self.db.commit()
        self._committed = True

    def rollback(self) -> None:
        """Explicitly rollback the transaction."""
        self.db.rollback()


def get_uow_from_db(db: Session) -> SqlAlchemyUnitOfWork:
    """Create a Unit of Work instance bound to an existing session."""
    return SqlAlchemyUnitOfWork(db)
