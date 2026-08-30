"""Tests for relational foreign keys, cascades, and cardinalities."""
import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from models import Business, Product, Inventory, Transaction, TransactionItem


def test_foreign_key_enforcement_on_product(db_session: Session):
    """Verify that inserting a product with a non-existent business_id fails due to FK violation."""
    invalid_product = Product(
        business_id=99999,  # Non-existent FK
        name="Ghost Item",
        category="General",
        sku="SKU-GHOST",
        unit_price=10.0
    )
    db_session.add(invalid_product)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_business_to_products_relationship(db_session: Session):
    """Verify 1-to-N relationship between Business and Products."""
    business = Business(name="Apparel Pro", industry="Fashion")
    db_session.add(business)
    db_session.commit()

    p1 = Product(business_id=business.id, name="Shirt", category="Tops", sku="TSH-01", unit_price=19.99)
    p2 = Product(business_id=business.id, name="Jeans", category="Bottoms", sku="JNS-01", unit_price=49.99)
    db_session.add_all([p1, p2])
    db_session.commit()

    # Re-query
    refreshed_biz = db_session.get(Business, business.id)
    assert len(refreshed_biz.products) == 2
    assert {p.sku for p in refreshed_biz.products} == {"TSH-01", "JNS-01"}


def test_product_to_inventory_one_to_one_and_cascade(db_session: Session):
    """Verify 1-to-1 Product to Inventory relationship and cascade deletion."""
    business = Business(name="Book Barn", industry="Publishing")
    db_session.add(business)
    db_session.commit()

    product = Product(business_id=business.id, name="Novel", category="Books", sku="BK-001", unit_price=12.0)
    db_session.add(product)
    db_session.commit()

    inventory = Inventory(product_id=product.id, quantity=100, reorder_level=20)
    db_session.add(inventory)
    db_session.commit()

    # Verify 1:1 uniqueness (second inventory with same product_id fails)
    duplicate_inv = Inventory(product_id=product.id, quantity=5, reorder_level=2)
    db_session.add(duplicate_inv)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # Verify cascade deletion of inventory when product is deleted
    prod_to_delete = db_session.get(Product, product.id)
    db_session.delete(prod_to_delete)
    db_session.commit()

    assert db_session.get(Inventory, inventory.id) is None


def test_transaction_and_transaction_items_relationship(db_session: Session):
    """Verify 1-to-N Transaction to TransactionItems and linkage to Product."""
    business = Business(name="Market Mart", industry="Grocery")
    db_session.add(business)
    db_session.commit()

    p1 = Product(business_id=business.id, name="Milk", category="Dairy", sku="MLK-01", unit_price=3.50)
    p2 = Product(business_id=business.id, name="Bread", category="Bakery", sku="BRD-01", unit_price=2.50)
    db_session.add_all([p1, p2])
    db_session.commit()

    tx = Transaction(business_id=business.id, transaction_type="sale", total_amount=9.50)
    db_session.add(tx)
    db_session.flush()

    item1 = TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=2, unit_price=3.50)
    item2 = TransactionItem(transaction_id=tx.id, product_id=p2.id, quantity=1, unit_price=2.50)
    db_session.add_all([item1, item2])
    db_session.commit()

    refreshed_tx = db_session.get(Transaction, tx.id)
    assert len(refreshed_tx.items) == 2
    assert refreshed_tx.items[0].product.name in ["Milk", "Bread"]
