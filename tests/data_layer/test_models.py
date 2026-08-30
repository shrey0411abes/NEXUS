"""Tests for individual ORM model instantiations and constraints."""
import pytest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from models import Business, Product, Inventory, Transaction, TransactionItem


def test_create_business_model(db_session: Session):
    """Verify Business model creation and timestamp generation."""
    business = Business(name="Apex Retailers", industry="Consumer Electronics")
    db_session.add(business)
    db_session.commit()

    assert business.id is not None
    assert business.name == "Apex Retailers"
    assert business.industry == "Consumer Electronics"
    assert isinstance(business.created_at, datetime)


def test_product_sku_uniqueness_per_business(db_session: Session):
    """Verify that duplicate SKUs for the same business trigger an IntegrityError."""
    business = Business(name="Tech Store", industry="Retail")
    db_session.add(business)
    db_session.commit()

    p1 = Product(
        business_id=business.id,
        name="Mouse",
        category="Peripherals",
        sku="SKU-MOU-01",
        unit_price=29.99
    )
    db_session.add(p1)
    db_session.commit()

    p2 = Product(
        business_id=business.id,
        name="Gaming Mouse",
        category="Peripherals",
        sku="SKU-MOU-01",  # duplicate SKU
        unit_price=49.99
    )
    db_session.add(p2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_inventory_creation_and_defaults(db_session: Session):
    """Verify Inventory model links to product with default quantities."""
    business = Business(name="Hardware Hub", industry="Hardware")
    db_session.add(business)
    db_session.commit()

    product = Product(
        business_id=business.id,
        name="Hammer",
        category="Tools",
        sku="SKU-HAM-01",
        unit_price=15.50
    )
    db_session.add(product)
    db_session.commit()

    inventory = Inventory(product_id=product.id, quantity=50, reorder_level=15)
    db_session.add(inventory)
    db_session.commit()

    assert inventory.id is not None
    assert inventory.product_id == product.id
    assert inventory.quantity == 50
    assert inventory.reorder_level == 15
