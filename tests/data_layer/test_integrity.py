"""
Tests for Phase 6 Database Integrity, CheckConstraints, FK Enforcement, and Rollback.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem
from repositories.product_repository import ProductRepository
from repositories.business_repository import BusinessRepository
from schemas.product import ProductCreate
from schemas.business import BusinessCreate


def test_sqlite_foreign_key_enforcement(db_session: Session):
    """Verify that foreign key enforcement rejects orphaned product records."""
    orphan_product = Product(
        business_id=99999,  # Nonexistent business
        name="Orphan Item",
        category="Test",
        sku="ORPHAN-01",
        unit_price=10.0,
    )
    db_session.add(orphan_product)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_check_constraint_negative_price_rejected(db_session: Session):
    """Verify that negative unit prices are rejected at the database level."""
    biz = Business(name="Integrity Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    invalid_product = Product(
        business_id=biz.id,
        name="Negative Price Item",
        category="Test",
        sku="NEG-01",
        unit_price=-15.0,  # Negative price violates CheckConstraint
    )
    db_session.add(invalid_product)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_check_constraint_negative_inventory_rejected(db_session: Session):
    """Verify that negative inventory quantity is rejected at the database level."""
    biz = Business(name="Inventory Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(
        business_id=biz.id,
        name="Valid Product",
        category="Test",
        sku="VALID-01",
        unit_price=20.0,
    )
    db_session.add(prod)
    db_session.flush()

    invalid_inv = Inventory(
        product_id=prod.id,
        quantity=-5,  # Negative quantity violates CheckConstraint
        reorder_level=10,
    )
    db_session.add(invalid_inv)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_repository_rollback_on_failed_create(db_session: Session):
    """Verify that repository methods automatically rollback on constraint failure."""
    repo = ProductRepository(db_session)
    invalid_in = ProductCreate(
        business_id=99999,  # Invalid FK
        name="Fail Product",
        category="Test",
        sku="FAIL-01",
        unit_price=10.0,
        initial_quantity=5,
        reorder_level=2,
    )
    with pytest.raises(IntegrityError):
        repo.create(invalid_in)

    # Session must be clean and usable for subsequent queries
    biz_count = db_session.scalar(text("SELECT count(*) FROM businesses"))
    assert biz_count is not None
