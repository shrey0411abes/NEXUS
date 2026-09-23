"""Unit and integration tests for Intelligence Services (Milestone 2-D).

Verifies AnalyticsService, RecommendationService, CrossDomainService, FinancialService
tenant isolation, IDOR prevention, parameter sanitization, and read-only purity.
"""
from decimal import Decimal
import pytest
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.business import Business
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionItem
from schemas.business import BusinessCreate
from schemas.product import ProductCreate
from schemas.transaction import TransactionCreate, TransactionItemCreate
from unit_of_work import SqlAlchemyUnitOfWork
from app.services.analytics_service import AnalyticsService
from app.services.recommendation_service import RecommendationService
from app.services.cross_domain_service import CrossDomainService
from app.services.financial_service import FinancialService
from repositories.business_repository import BusinessRepository
from repositories.product_repository import ProductRepository
from repositories.transaction_repository import TransactionRepository


def _setup_tenant_with_catalog_and_sales(
    db: Session,
    name: str,
    sku_prefix: str,
) -> tuple[Business, Product, Product]:
    biz_repo = BusinessRepository(db)
    prod_repo = ProductRepository(db)
    tx_repo = TransactionRepository(db)

    biz = biz_repo.create(BusinessCreate(name=name, industry="Retail"))

    prod1 = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name=f"{sku_prefix} Fast",
        category="General",
        sku=f"{sku_prefix}-FAST",
        unit_price=Decimal("50.00"),
        initial_quantity=5,  # Low stock -> risk
        reorder_level=10,
    ))
    prod2 = prod_repo.create(ProductCreate(
        business_id=biz.id,
        name=f"{sku_prefix} Stagnant",
        category="General",
        sku=f"{sku_prefix}-STAG",
        unit_price=Decimal("20.00"),
        initial_quantity=100,
        reorder_level=10,
    ))

    # Add transactions for prod1
    tx_repo.create(TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        items=[TransactionItemCreate(product_id=prod1.id, quantity=3, unit_price=Decimal("50.00"))]
    ))
    db.commit()
    return biz, prod1, prod2


# ─── ANALYTICS SERVICE TESTS ───────────────────────────────────────────────────

def test_analytics_service_product_sales_tenant_isolation(db_session: Session):
    """Verify get_product_sales_analytics returns 404 for cross-tenant products (IDOR prevention)."""
    biz_a, prod_a1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz A", "SKU-A")
    biz_b, prod_b1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz B", "SKU-B")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = AnalyticsService(uow)

    # Valid tenant access
    metrics = service.get_product_sales_analytics(business_id=biz_a.id, product_id=prod_a1.id, days=30)
    assert metrics.product_id == prod_a1.id

    # Cross-tenant IDOR access -> 404
    with pytest.raises(HTTPException) as exc_info:
        service.get_product_sales_analytics(business_id=biz_a.id, product_id=prod_b1.id, days=30)
    assert exc_info.value.status_code == 404

    # Nonexistent product -> 404
    with pytest.raises(HTTPException) as exc_missing:
        service.get_product_sales_analytics(business_id=biz_a.id, product_id=99999, days=30)
    assert exc_missing.value.status_code == 404


def test_analytics_service_anomalies_product_filter_tenant_isolation(db_session: Session):
    """Verify get_sales_anomalies rejects cross-tenant product_id filter with 404."""
    biz_a, _, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz A", "SKU-A-ANO")
    biz_b, prod_b1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz B", "SKU-B-ANO")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = AnalyticsService(uow)

    # Cross-tenant product filter -> 404
    with pytest.raises(HTTPException) as exc_info:
        service.get_sales_anomalies(business_id=biz_a.id, product_id=prod_b1.id, days=30)
    assert exc_info.value.status_code == 404


def test_analytics_service_window_bounds_sanitization(db_session: Session):
    """Verify analytics methods safely handle negative or extreme observation windows."""
    biz, prod, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz Win", "SKU-WIN")
    uow = SqlAlchemyUnitOfWork(db_session)
    service = AnalyticsService(uow)

    kpis = service.get_business_kpis(business_id=biz.id, days=-10)
    assert kpis.total_revenue >= 0

    risks = service.get_inventory_risks(business_id=biz.id, days=1000)
    assert isinstance(risks, list)

    trends = service.get_demand_trends(business_id=biz.id, days=-5)
    assert isinstance(trends, list)


# ─── RECOMMENDATION SERVICE TESTS ──────────────────────────────────────────────

def test_recommendation_service_tenant_isolation(db_session: Session):
    """Verify recommendations are strictly scoped to the authenticated business."""
    biz_a, _, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz A", "SKU-A-REC")
    biz_b, _, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz B", "SKU-B-REC")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = RecommendationService(uow)

    recs_a = service.get_recommendations(business_id=biz_a.id, days=30)
    assert isinstance(recs_a, list)

    # Ensure no recommendation references products from Tenant B
    prod_ids_b = [p.id for p in uow.products.get_all(business_id=biz_b.id)]
    for r in recs_a:
        assert r.product_id not in prod_ids_b


# ─── CROSS-DOMAIN SERVICE TESTS ────────────────────────────────────────────────

def test_cross_domain_service_tenant_isolation(db_session: Session):
    """Verify CrossDomainService outputs only reference the authenticated tenant's products."""
    biz_a, _, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz A", "SKU-A-CD")
    biz_b, _, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz B", "SKU-B-CD")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = CrossDomainService(uow)

    risks_a = service.get_risks(business_id=biz_a.id, days=30)
    priorities_a = service.get_priorities(business_id=biz_a.id, days=30)
    summary_a = service.get_summary(business_id=biz_a.id, days=30)

    prod_ids_b = {p.id for p in uow.products.get_all(business_id=biz_b.id)}

    for r in risks_a:
        assert r.product_id not in prod_ids_b
    for p in priorities_a:
        assert p.product_id not in prod_ids_b
    for r in summary_a.correlations:
        assert r.product_id not in prod_ids_b


# ─── FINANCIAL SERVICE TESTS ───────────────────────────────────────────────────

def test_financial_service_tenant_isolation(db_session: Session):
    """Verify FinancialService scopes SKU impacts and financial summary strictly to the tenant."""
    biz_a, prod_a1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz A", "SKU-A-FIN")
    biz_b, prod_b1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Biz B", "SKU-B-FIN")

    uow = SqlAlchemyUnitOfWork(db_session)
    service = FinancialService(uow)

    impacts_a = service.get_sku_impacts(business_id=biz_a.id, days=30)
    summary_a = service.get_summary(business_id=biz_a.id, days=30)

    prod_ids_a = {prod_a1.id}
    prod_ids_b = {prod_b1.id}

    for impact in impacts_a:
        assert impact.product_id not in prod_ids_b

    assert summary_a.total_active_sku_count == 2
    assert summary_a.total_daily_revenue_exposure >= Decimal("0.00")


# ─── READ-ONLY PURITY TESTS ────────────────────────────────────────────────────

def test_intelligence_services_read_only_purity(db_session: Session):
    """Verify that intelligence operations do not mutate the database or create transactions."""
    biz, prod1, _ = _setup_tenant_with_catalog_and_sales(db_session, "Purity Biz", "SKU-PUR")

    # Record baseline row counts across all domain tables
    count_biz = db_session.scalar(func.count(Business.id))
    count_prod = db_session.scalar(func.count(Product.id))
    count_inv = db_session.scalar(func.count(Inventory.id))
    count_tx = db_session.scalar(func.count(Transaction.id))
    count_txi = db_session.scalar(func.count(TransactionItem.id))

    uow = SqlAlchemyUnitOfWork(db_session)
    analytics_svc = AnalyticsService(uow)
    rec_svc = RecommendationService(uow)
    cd_svc = CrossDomainService(uow)
    fin_svc = FinancialService(uow)

    # Execute all intelligence operations
    analytics_svc.get_business_kpis(biz.id, days=30)
    analytics_svc.get_product_sales_analytics(biz.id, prod1.id, days=30)
    analytics_svc.get_inventory_risks(biz.id, days=30)
    analytics_svc.get_demand_trends(biz.id, days=14)
    analytics_svc.get_sales_anomalies(biz.id, product_id=None, days=30)
    rec_svc.get_recommendations(biz.id, days=30)
    cd_svc.get_risks(biz.id, days=30)
    cd_svc.get_priorities(biz.id, days=30)
    cd_svc.get_summary(biz.id, days=30)
    fin_svc.get_sku_impacts(biz.id, days=30)
    fin_svc.get_summary(biz.id, days=30)

    # Re-verify row counts are strictly unchanged
    assert db_session.scalar(func.count(Business.id)) == count_biz
    assert db_session.scalar(func.count(Product.id)) == count_prod
    assert db_session.scalar(func.count(Inventory.id)) == count_inv
    assert db_session.scalar(func.count(Transaction.id)) == count_tx
    assert db_session.scalar(func.count(TransactionItem.id)) == count_txi
