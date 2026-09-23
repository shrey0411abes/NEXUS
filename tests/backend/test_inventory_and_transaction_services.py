"""Unit and integration tests for Inventory and Transaction services and repositories.

Verifies tenant isolation, UoW transaction boundaries, atomicity, and IDOR protection.
"""
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.business import Business
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction
from schemas.business import BusinessCreate
from schemas.product import ProductCreate
from schemas.inventory import InventoryUpdate
from schemas.transaction import TransactionCreate, TransactionItemCreate
from unit_of_work import SqlAlchemyUnitOfWork
from app.services.inventory_service import InventoryService
from app.services.transaction_service import TransactionService
from repositories.business_repository import BusinessRepository
from repositories.product_repository import ProductRepository
from repositories.inventory_repository import InventoryRepository
from repositories.transaction_repository import TransactionRepository


def _setup_tenant_with_product(db: Session, name: str, sku: str) -> tuple[Business, Product]:
    biz_repo = BusinessRepository(db)
    prod_repo = ProductRepository(db)
    biz = biz_repo.create(BusinessCreate(name=name, industry="Retail"))
    prod = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name=f"Product {sku}",
        category="General",
        sku=sku,
        unit_price=Decimal("25.00"),
        initial_quantity=50,
        reorder_level=10,
    ))
    db.commit()
    return biz, prod


# ─── INVENTORY SERVICE TESTS ───────────────────────────────────────────────────

def test_inventory_service_tenant_scoping(db_session: Session):
    """Verify get_inventory_list returns strictly the authenticated tenant's inventory."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Store A", "SKU-A-INV")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Store B", "SKU-B-INV")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = InventoryService(uow)

    inv_a = service.get_inventory_list(business_id=biz_a.id)
    assert len(inv_a) == 1
    assert inv_a[0].product_id == prod_a.id
    assert inv_a[0].product_id != prod_b.id


def test_inventory_service_get_for_product_idor(db_session: Session):
    """Verify cross-tenant inventory access yields 404 (IDOR prevention)."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Store A", "SKU-A-IDOR")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Store B", "SKU-B-IDOR")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = InventoryService(uow)

    # Valid tenant access
    inv = service.get_inventory_for_product(business_id=biz_a.id, product_id=prod_a.id)
    assert inv.product_id == prod_a.id

    # Cross-tenant product inventory access -> 404
    with pytest.raises(HTTPException) as exc_info:
        service.get_inventory_for_product(business_id=biz_a.id, product_id=prod_b.id)
    assert exc_info.value.status_code == 404

    # Nonexistent product ID -> 404
    with pytest.raises(HTTPException) as exc_info_missing:
        service.get_inventory_for_product(business_id=biz_a.id, product_id=99999)
    assert exc_info_missing.value.status_code == 404


def test_inventory_service_update_tenant_isolation(db_session: Session):
    """Verify tenant cannot update inventory for another tenant's product."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Store A", "SKU-A-UPD")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Store B", "SKU-B-UPD")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = InventoryService(uow)

    # Tenant A attempts to mutate Tenant B's product inventory -> 404
    with pytest.raises(HTTPException) as exc_info:
        service.update_inventory(
            business_id=biz_a.id,
            product_id=prod_b.id,
            inventory_in=InventoryUpdate(quantity=100),
        )
    assert exc_info.value.status_code == 404


def test_inventory_service_update_success_and_persistence(db_session: Session):
    """Verify authorized inventory update succeeds and persists atomically."""
    biz, prod = _setup_tenant_with_product(db_session, "Store Main", "SKU-MAIN")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = InventoryService(uow)

    updated = service.update_inventory(
        business_id=biz.id,
        product_id=prod.id,
        inventory_in=InventoryUpdate(quantity=77, reorder_level=15),
    )
    assert updated.quantity == 77
    assert updated.reorder_level == 15

    # Verify query reflects new values
    refreshed = service.get_inventory_for_product(business_id=biz.id, product_id=prod.id)
    assert refreshed.quantity == 77
    assert refreshed.reorder_level == 15


def test_inventory_service_pagination_bounds(db_session: Session):
    """Verify get_inventory_list safely clamps negative or excessive pagination parameters."""
    biz, prod = _setup_tenant_with_product(db_session, "Store Pag", "SKU-PAG")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = InventoryService(uow)

    inv = service.get_inventory_list(business_id=biz.id, limit=-5, offset=-10)
    assert len(inv) == 1


def test_inventory_repository_count(db_session: Session):
    """Verify InventoryRepository.count returns tenant-scoped inventory count."""
    biz_a, _ = _setup_tenant_with_product(db_session, "Biz A", "SKU-CNT-A")
    biz_b, _ = _setup_tenant_with_product(db_session, "Biz B", "SKU-CNT-B")

    repo = InventoryRepository(db_session)
    assert repo.count(biz_a.id) == 1
    assert repo.count(biz_b.id) == 1
    assert repo.count() == 2


# ─── TRANSACTION SERVICE TESTS ─────────────────────────────────────────────────

def test_transaction_service_create_success_with_items(db_session: Session):
    """Verify TransactionService creates transaction and multiple line items within a single atomic UoW."""
    biz, prod1 = _setup_tenant_with_product(db_session, "Tx Store", "SKU-TX-1")
    prod_repo = ProductRepository(db_session)
    prod2 = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name="Product 2",
        category="General",
        sku="SKU-TX-2",
        unit_price=Decimal("10.00"),
        initial_quantity=30,
    ))
    db_session.commit()

    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    tx_in = TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        total_amount=None,  # Auto-calculate: (2 * 25.00) + (3 * 10.00) = 50.00 + 30.00 = 80.00
        items=[
            TransactionItemCreate(product_id=prod1.id, quantity=2, unit_price=Decimal("25.00")),
            TransactionItemCreate(product_id=prod2.id, quantity=3, unit_price=Decimal("10.00")),
        ]
    )

    tx = service.create_transaction(business_id=biz.id, transaction_in=tx_in)
    assert tx.id is not None
    assert tx.business_id == biz.id
    assert tx.total_amount == Decimal("80.00")
    assert len(tx.items) == 2


def test_transaction_service_authoritative_tenant_override(db_session: Session):
    """Verify payload business_id is overridden by authenticated tenant context."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Tx Tenant A", "SKU-TX-A")
    biz_b, _ = _setup_tenant_with_product(db_session, "Tx Tenant B", "SKU-TX-B")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    # Payload claims biz_b.id, but service is called with biz_a.id
    tx_in = TransactionCreate(
        business_id=biz_b.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod_a.id, quantity=1, unit_price=Decimal("25.00"))]
    )
    tx = service.create_transaction(business_id=biz_a.id, transaction_in=tx_in)
    assert tx.business_id == biz_a.id
    assert tx.business_id != biz_b.id


def test_transaction_service_cross_business_product_rejection(db_session: Session):
    """Verify referencing another tenant's product raises 400 Bad Request."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Store A", "SKU-X-A")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Store B", "SKU-X-B")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    # Biz A tries to sell Biz B's product
    tx_in = TransactionCreate(
        business_id=biz_a.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod_b.id, quantity=1, unit_price=Decimal("25.00"))]
    )
    with pytest.raises(HTTPException) as exc_info:
        service.create_transaction(business_id=biz_a.id, transaction_in=tx_in)

    assert exc_info.value.status_code == 400
    assert "Cross-business product mismatch" in exc_info.value.detail


def test_transaction_service_nonexistent_product_rejection(db_session: Session):
    """Verify referencing a nonexistent product raises 404 Not Found."""
    biz, _ = _setup_tenant_with_product(db_session, "Store None", "SKU-NONE")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    tx_in = TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=99999, quantity=1, unit_price=Decimal("10.00"))]
    )
    with pytest.raises(HTTPException) as exc_info:
        service.create_transaction(business_id=biz.id, transaction_in=tx_in)

    assert exc_info.value.status_code == 404
    assert "does not exist" in exc_info.value.detail


def test_transaction_service_atomic_rollback_on_failure(db_session: Session, monkeypatch):
    """Verify transaction and line items are completely rolled back if an error occurs."""
    biz, prod = _setup_tenant_with_product(db_session, "Store RB", "SKU-TX-RB")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    def failing_create(tx_in):
        raise RuntimeError("Simulated DB crash during transaction item insertion")

    monkeypatch.setattr(uow.transactions, "create", failing_create)

    tx_in = TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod.id, quantity=1, unit_price=Decimal("25.00"))]
    )

    with pytest.raises(RuntimeError, match="Simulated DB crash"):
        service.create_transaction(business_id=biz.id, transaction_in=tx_in)

    # Verify no transaction was persisted
    tx_count = db_session.query(Transaction).filter(Transaction.business_id == biz.id).count()
    assert tx_count == 0


def test_transaction_service_get_by_id_tenant_isolation(db_session: Session):
    """Verify cross-tenant transaction retrieval returns 404 (IDOR prevention)."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Store A", "SKU-ISO-A")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Store B", "SKU-ISO-B")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    tx_a = service.create_transaction(
        business_id=biz_a.id,
        transaction_in=TransactionCreate(
            business_id=biz_a.id,
            transaction_type="sale",
            items=[TransactionItemCreate(product_id=prod_a.id, quantity=1, unit_price=Decimal("25.00"))]
        )
    )
    tx_b = service.create_transaction(
        business_id=biz_b.id,
        transaction_in=TransactionCreate(
            business_id=biz_b.id,
            transaction_type="sale",
            items=[TransactionItemCreate(product_id=prod_b.id, quantity=1, unit_price=Decimal("25.00"))]
        )
    )

    # Valid tenant access
    fetched = service.get_transaction_by_id(business_id=biz_a.id, transaction_id=tx_a.id)
    assert fetched.id == tx_a.id

    # Cross-tenant access -> 404
    with pytest.raises(HTTPException) as exc_info:
        service.get_transaction_by_id(business_id=biz_a.id, transaction_id=tx_b.id)
    assert exc_info.value.status_code == 404

    # Nonexistent transaction ID -> 404
    with pytest.raises(HTTPException) as exc_info_missing:
        service.get_transaction_by_id(business_id=biz_a.id, transaction_id=99999)
    assert exc_info_missing.value.status_code == 404


def test_transaction_service_pagination_bounds(db_session: Session):
    """Verify get_transactions safely clamps negative or excessive pagination parameters."""
    biz, prod = _setup_tenant_with_product(db_session, "Store TxPag", "SKU-TXPAG")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = TransactionService(uow)

    txs = service.get_transactions(business_id=biz.id, limit=-5, offset=-10)
    assert isinstance(txs, list)


def test_transaction_repository_count(db_session: Session):
    """Verify TransactionRepository.count returns tenant-scoped transaction count."""
    biz_a, prod_a = _setup_tenant_with_product(db_session, "Count Tx A", "SKU-CTX-A")
    biz_b, prod_b = _setup_tenant_with_product(db_session, "Count Tx B", "SKU-CTX-B")

    tx_repo = TransactionRepository(db_session)
    assert tx_repo.count(biz_a.id) == 0

    tx_repo.create(TransactionCreate(
        business_id=biz_a.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod_a.id, quantity=1, unit_price=Decimal("10.00"))]
    ))
    tx_repo.create(TransactionCreate(
        business_id=biz_b.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod_b.id, quantity=1, unit_price=Decimal("20.00"))]
    ))
    db_session.commit()

    assert tx_repo.count(biz_a.id) == 1
    assert tx_repo.count(biz_b.id) == 1
    assert tx_repo.count() == 2
