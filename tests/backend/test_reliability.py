"""
Tests for API Reliability, Error Masking, and Analytics Edge Cases (auth-aware).
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models import Business
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.financial_analyzer import FinancialAnalyzer
from cross_domain_engine import CrossDomainEngine


def test_empty_business_analytics_resilience(db_session: Session):
    """Verify that all analytics engines return valid deterministic empty states for a business with 0 products/sales."""
    biz = Business(name="Brand New Startup", industry="Services")
    db_session.add(biz)
    db_session.commit()

    # 1. Sales Analyzer
    sales_analyzer = SalesAnalyzer(db_session)
    kpis = sales_analyzer.get_business_kpis(business_id=biz.id, days=30)
    assert kpis.total_revenue == 0.0
    assert kpis.total_transactions == 0
    assert kpis.total_units_sold == 0
    assert kpis.active_products_count == 0

    # 2. Inventory Analyzer
    inv_analyzer = InventoryAnalyzer(db_session)
    risks = inv_analyzer.get_stock_risk_indicators(business_id=biz.id, days=30)
    assert risks == []

    # 3. Cross Domain Engine
    cross_engine = CrossDomainEngine(db_session)
    correlations = cross_engine.analyze_cross_domain_risks(business_id=biz.id, days=30)
    assert correlations == []
    priorities = cross_engine.prioritize_operational_risks(business_id=biz.id, days=30)
    assert priorities == []

    # 4. Financial Analyzer
    fin_analyzer = FinancialAnalyzer(db_session)
    fin_summary = fin_analyzer.get_business_financial_summary(business_id=biz.id, days=30)
    assert fin_summary.total_daily_revenue_exposure == 0.0
    assert fin_summary.total_retail_inventory_value_on_hand == 0.0
    assert fin_summary.impacted_skus == []


def test_invalid_parameters_handling(client: TestClient, db_session: Session):
    """Verify that invalid API parameters return standard 422 validation errors without crashing."""
    # Negative observation window — no business_id needed (auth-bound)
    res = client.get("/api/v1/analytics/kpis?days=-5")
    assert res.status_code == 422
    assert "detail" in res.json()

    # Window exceeding maximum (le=365)
    res_max = client.get("/api/v1/analytics/kpis?days=999")
    assert res_max.status_code == 422
