"""Tests for repository classes in data-layer."""
from sqlalchemy.orm import Session
from schemas.business import BusinessCreate
from schemas.product import ProductCreate
from schemas.inventory import InventoryUpdate
from schemas.transaction import TransactionCreate, TransactionItemCreate
from repositories import (
    BusinessRepository,
    ProductRepository,
    InventoryRepository,
    TransactionRepository,
)


def test_business_repository_crud(db_session: Session):
    """Verify BusinessRepository operations."""
    repo = BusinessRepository(db_session)
    biz = repo.create(BusinessCreate(name="Urban Cafe", industry="Hospitality"))

    assert biz.id is not None
    assert biz.name == "Urban Cafe"

    fetched = repo.get_by_id(biz.id)
    assert fetched is not None
    assert fetched.name == "Urban Cafe"

    all_biz = repo.get_all()
    assert len(all_biz) == 1


def test_product_and_inventory_repository_workflow(db_session: Session):
    """Verify ProductRepository and InventoryRepository synchronization."""
    biz_repo = BusinessRepository(db_session)
    biz = biz_repo.create(BusinessCreate(name="Tech Gear", industry="Electronics"))

    prod_repo = ProductRepository(db_session)
    product = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name="Wireless Keyboard",
        category="Accessories",
        sku="KEY-001",
        unit_price=45.0,
        initial_quantity=75,
        reorder_level=12
    ))

    assert product.id is not None
    assert product.inventory is not None
    assert product.inventory.quantity == 75

    inv_repo = InventoryRepository(db_session)
    inv = inv_repo.get_by_product_id(product.id)
    assert inv is not None
    assert inv.quantity == 75

    # Update stock
    updated_inv = inv_repo.update(product.id, InventoryUpdate(quantity=60, reorder_level=10))
    assert updated_inv.quantity == 60
    assert updated_inv.reorder_level == 10


def test_transaction_repository_auto_total_calculation(db_session: Session):
    """Verify TransactionRepository computes total amount from line items."""
    biz_repo = BusinessRepository(db_session)
    biz = biz_repo.create(BusinessCreate(name="Auto Parts Co", industry="Automotive"))

    prod_repo = ProductRepository(db_session)
    p1 = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name="Oil Filter",
        category="Filters",
        sku="FILT-01",
        unit_price=12.0,
        initial_quantity=100
    ))
    p2 = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name="Air Filter",
        category="Filters",
        sku="FILT-02",
        unit_price=18.0,
        initial_quantity=50
    ))

    tx_repo = TransactionRepository(db_session)
    tx = tx_repo.create(TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        total_amount=None,  # Should auto-calculate: (2 * 12.0) + (3 * 18.0) = 24 + 54 = 78.0
        items=[
            TransactionItemCreate(product_id=p1.id, quantity=2, unit_price=12.0),
            TransactionItemCreate(product_id=p2.id, quantity=3, unit_price=18.0),
        ]
    ))

    assert tx.id is not None
    assert tx.total_amount == 78.0
    assert len(tx.items) == 2


def test_transaction_cross_business_product_rejection(db_session: Session):
    """Verify that transactions cannot reference products belonging to a different business."""
    import pytest
    biz_repo = BusinessRepository(db_session)
    prod_repo = ProductRepository(db_session)
    tx_repo = TransactionRepository(db_session)

    biz_a = biz_repo.create(BusinessCreate(name="Business A", industry="Retail"))
    biz_b = biz_repo.create(BusinessCreate(name="Business B", industry="Retail"))

    prod_b = prod_repo.create(ProductCreate(
        business_id=biz_b.id,
        name="Product B",
        category="Goods",
        sku="SKU-B",
        unit_price=30.0,
    ))

    # Attempt to create transaction under Business A referencing Product B
    with pytest.raises(ValueError, match="Cross-business product mismatch"):
        tx_repo.create(TransactionCreate(
            business_id=biz_a.id,
            transaction_type="sale",
            items=[
                TransactionItemCreate(product_id=prod_b.id, quantity=1, unit_price=30.0),
            ]
        ))


def test_transaction_nonexistent_product_rejection(db_session: Session):
    """Verify that transactions cannot reference nonexistent product IDs."""
    import pytest
    biz_repo = BusinessRepository(db_session)
    tx_repo = TransactionRepository(db_session)

    biz = biz_repo.create(BusinessCreate(name="Single Biz", industry="Retail"))

    with pytest.raises(ValueError, match="does not exist"):
        tx_repo.create(TransactionCreate(
            business_id=biz.id,
            transaction_type="sale",
            items=[
                TransactionItemCreate(product_id=99999, quantity=2, unit_price=10.0),
            ]
        ))

