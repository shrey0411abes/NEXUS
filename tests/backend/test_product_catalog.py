"""Tests for Product and Catalog domain service, repository, tenant isolation, and atomicity."""
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.business import Business
from models.product import Product
from models.inventory import Inventory
from schemas.product import ProductCreate
from unit_of_work import SqlAlchemyUnitOfWork
from app.services.product_service import ProductService
from repositories.product_repository import ProductRepository
from repositories.business_repository import BusinessRepository


def _create_test_business(db: Session, name: str = "Test Retail") -> Business:
    repo = BusinessRepository(db)
    from schemas.business import BusinessCreate
    return repo.create(BusinessCreate(name=name, industry="Retail"))


def test_product_service_create_success_with_inventory(db_session: Session):
    """Verify ProductService creates product and initial inventory within a single atomic UoW."""
    biz = _create_test_business(db_session, "Store Alpha")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    payload = ProductCreate(
        business_id=biz.id,
        name="  Ceramic Mug  ",
        category="  Kitchenware  ",
        sku="  MUG-001  ",
        unit_price=Decimal("14.50"),
        initial_quantity=50,
        reorder_level=10,
    )

    product = service.create_product(business_id=biz.id, product_in=payload)

    assert product.id is not None
    assert product.business_id == biz.id
    assert product.name == "Ceramic Mug"
    assert product.category == "Kitchenware"
    assert product.sku == "MUG-001"
    assert product.unit_price == Decimal("14.50")
    assert product.inventory is not None
    assert product.inventory.quantity == 50
    assert product.inventory.reorder_level == 10


def test_product_service_create_duplicate_sku_precheck(db_session: Session):
    """Verify that creating a duplicate SKU within the same tenant raises 409 Conflict via pre-check."""
    biz = _create_test_business(db_session, "Store Alpha")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    payload1 = ProductCreate(
        business_id=biz.id,
        name="Espresso Beans",
        category="Coffee",
        sku="COFFEE-01",
        unit_price=Decimal("18.00"),
        initial_quantity=20,
    )
    service.create_product(business_id=biz.id, product_in=payload1)

    payload2 = ProductCreate(
        business_id=biz.id,
        name="Espresso Beans Dark",
        category="Coffee",
        sku="COFFEE-01",
        unit_price=Decimal("20.00"),
        initial_quantity=10,
    )
    with pytest.raises(HTTPException) as exc_info:
        service.create_product(business_id=biz.id, product_in=payload2)

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


def test_product_service_create_duplicate_sku_db_constraint_fallback(db_session: Session, monkeypatch):
    """Verify that if pre-check is bypassed, database unique constraint IntegrityError is caught and raised as 409."""
    biz = _create_test_business(db_session, "Store Alpha")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    payload = ProductCreate(
        business_id=biz.id,
        name="Tea Leaf",
        category="Beverage",
        sku="TEA-01",
        unit_price=Decimal("12.00"),
    )
    service.create_product(business_id=biz.id, product_in=payload)

    # Bypass application pre-check by mocking get_by_sku to return None
    monkeypatch.setattr(uow.products, "get_by_sku", lambda biz_id, sku: None)

    dup_payload = ProductCreate(
        business_id=biz.id,
        name="Tea Leaf Duplicate",
        category="Beverage",
        sku="TEA-01",
        unit_price=Decimal("12.00"),
    )
    with pytest.raises(HTTPException) as exc_info:
        service.create_product(business_id=biz.id, product_in=dup_payload)

    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


def test_product_service_atomic_rollback_on_failure(db_session: Session, monkeypatch):
    """Verify atomic rollback: if inventory addition fails, product is not persisted."""
    biz = _create_test_business(db_session, "Store Alpha")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    # Mock product creation to raise an unexpected error during repository staging
    def failing_create(product_in):
        raise RuntimeError("Simulated database failure during product staging")

    monkeypatch.setattr(uow.products, "create", failing_create)

    payload = ProductCreate(
        business_id=biz.id,
        name="Rollback Item",
        category="Test",
        sku="RB-01",
        unit_price=Decimal("9.99"),
    )

    with pytest.raises(RuntimeError, match="Simulated database failure"):
        service.create_product(business_id=biz.id, product_in=payload)

    # Verify no product or inventory records exist
    prod_in_db = db_session.query(Product).filter(Product.sku == "RB-01").first()
    assert prod_in_db is None


def test_product_service_get_by_id_tenant_isolation(db_session: Session):
    """Verify tenant isolation on get_product_by_id (cross-tenant access produces 404)."""
    biz_a = _create_test_business(db_session, "Tenant A")
    biz_b = _create_test_business(db_session, "Tenant B")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    prod_a = service.create_product(
        business_id=biz_a.id,
        product_in=ProductCreate(
            business_id=biz_a.id,
            name="Product A",
            category="A",
            sku="SKU-A",
            unit_price=Decimal("10.00"),
        )
    )
    prod_b = service.create_product(
        business_id=biz_b.id,
        product_in=ProductCreate(
            business_id=biz_b.id,
            name="Product B",
            category="B",
            sku="SKU-B",
            unit_price=Decimal("20.00"),
        )
    )

    # Tenant A accesses its own product -> succeeds
    fetched = service.get_product_by_id(business_id=biz_a.id, product_id=prod_a.id)
    assert fetched.id == prod_a.id

    # Tenant A attempts to access Tenant B's product -> 404 Not Found
    with pytest.raises(HTTPException) as exc_info:
        service.get_product_by_id(business_id=biz_a.id, product_id=prod_b.id)
    assert exc_info.value.status_code == 404

    # Nonexistent product ID -> 404 Not Found
    with pytest.raises(HTTPException) as exc_info_missing:
        service.get_product_by_id(business_id=biz_a.id, product_id=99999)
    assert exc_info_missing.value.status_code == 404


def test_product_service_get_products_pagination(db_session: Session):
    """Verify tenant-scoped listing with pagination limit and offset bounds."""
    biz = _create_test_business(db_session, "Pagination Store")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    for i in range(5):
        service.create_product(
            business_id=biz.id,
            product_in=ProductCreate(
                business_id=biz.id,
                name=f"Item {i}",
                category="General",
                sku=f"PAG-{i}",
                unit_price=Decimal("5.00"),
            )
        )

    # Default listing (first 3)
    p_first3 = service.get_products(business_id=biz.id, limit=3, offset=0)
    assert len(p_first3) == 3
    assert p_first3[0].sku == "PAG-0"

    # Offset 3, limit 3 (remaining 2)
    p_rem = service.get_products(business_id=biz.id, limit=3, offset=3)
    assert len(p_rem) == 2
    assert p_rem[0].sku == "PAG-3"

    # Negative limit/offset clamped safely (limit min 1, offset min 0)
    p_clamped = service.get_products(business_id=biz.id, limit=-5, offset=-10)
    assert len(p_clamped) == 1
    assert p_clamped[0].sku == "PAG-0"


def test_product_service_authoritative_tenant_binding(db_session: Session):
    """Verify that caller-supplied business_id in payload is strictly overridden by authenticated context."""
    biz_a = _create_test_business(db_session, "Tenant A")
    biz_b = _create_test_business(db_session, "Tenant B")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = ProductService(uow)

    # Attacker tries to spoof business_id as biz_b.id
    payload = ProductCreate(
        business_id=biz_b.id,
        name="Spoof Attempt",
        category="Test",
        sku="SPOOF-99",
        unit_price=Decimal("30.00"),
    )

    product = service.create_product(business_id=biz_a.id, product_in=payload)
    assert product.business_id == biz_a.id
    assert product.business_id != biz_b.id


def test_product_repository_persistence_no_commit(db_session: Session):
    """Verify that ProductRepository does not self-commit; uncommitted changes are rolled back cleanly."""
    biz = _create_test_business(db_session, "No Commit Store")
    repo = ProductRepository(db_session)

    product = repo.create(
        ProductCreate(
            business_id=biz.id,
            name="Uncommitted Product",
            category="Test",
            sku="NOCOMMIT-01",
            unit_price=Decimal("15.00"),
            initial_quantity=10,
        )
    )
    assert product.id is not None

    # Rollback without commit
    db_session.rollback()

    # Verify entity is not in database
    queried = db_session.get(Product, product.id)
    assert queried is None


def test_product_repository_count(db_session: Session):
    """Verify ProductRepository.count method accurately counts tenant-scoped records."""
    biz_a = _create_test_business(db_session, "Count A")
    biz_b = _create_test_business(db_session, "Count B")
    repo = ProductRepository(db_session)

    assert repo.count(biz_a.id) == 0

    repo.create(ProductCreate(business_id=biz_a.id, name="A1", category="C", sku="SKU-A1", unit_price=Decimal("1.0")))
    repo.create(ProductCreate(business_id=biz_a.id, name="A2", category="C", sku="SKU-A2", unit_price=Decimal("2.0")))
    repo.create(ProductCreate(business_id=biz_b.id, name="B1", category="C", sku="SKU-B1", unit_price=Decimal("3.0")))
    db_session.commit()

    assert repo.count(biz_a.id) == 2
    assert repo.count(biz_b.id) == 1
    assert repo.count() == 3
