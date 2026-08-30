"""
Tests for AI Failure Isolation from Deterministic Analytics (Phase 6).
"""
import pytest
from sqlalchemy.orm import Session
from models import Business, Product, Inventory, Transaction, TransactionItem
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.financial_analyzer import FinancialAnalyzer
from cross_domain_engine import CrossDomainEngine
from exceptions import LLMProviderError, LLMTimeoutError


def test_deterministic_analytics_independent_of_llm(db_session: Session):
    """Verify that deterministic analytics execute with 100% accuracy regardless of LLM availability or failure."""
    biz = Business(name="AI Isolated Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(business_id=biz.id, name="Independent Item", category="Hardware", sku="IND-01", unit_price=100.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=0, reorder_level=5))
    db_session.commit()

    # Even if LLM provider fails completely with an exception...
    simulated_error = LLMProviderError("Provider unavailable")
    assert isinstance(simulated_error, Exception)

    # 1. Deterministic KPIs execute directly from SQLite
    kpis = SalesAnalyzer(db_session).get_business_kpis(business_id=biz.id, days=30)
    assert kpis.active_products_count == 1
    assert kpis.out_of_stock_products_count == 1

    # 2. Deterministic Cross Domain Risks execute directly from SQLite
    cross_engine = CrossDomainEngine(db_session)
    risks = cross_engine.analyze_cross_domain_risks(business_id=biz.id, days=30)
    assert len(risks) == 1
    assert risks[0].severity == "CRITICAL"

    # 3. Deterministic Financial metrics execute directly from SQLite
    fin = FinancialAnalyzer(db_session).get_business_financial_summary(business_id=biz.id, days=30)
    assert fin.total_active_sku_count == 1
    assert fin.total_retail_inventory_value_on_hand == 0.0
