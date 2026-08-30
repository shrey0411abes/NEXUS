"""Tests for Phase 4A Deterministic Financial Impact & Retail Asset Analyzer."""
from datetime import datetime, timezone, timedelta
# pyrefly: ignore [missing-import]
import pytest
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

# pyrefly: ignore [missing-import]
from models import Business, Product, Inventory, Transaction, TransactionItem
# pyrefly: ignore [missing-import]
from analyzers.financial_analyzer import FinancialAnalyzer


def seed_financial_scenario(db: Session) -> Business:
    """Helper creating a business with known prices, stock levels, and sales velocities."""
    biz = Business(name="Financial Test Enterprise", industry="Retail")
    db.add(biz)
    db.flush()

    now = datetime.now(timezone.utc)

    # 1. Critical Stockout SKU with active velocity: Price $100, Qty 0, Sold 30 units over 30 days => velocity 1.0/day
    p1 = Product(business_id=biz.id, name="Exposed Flagship", category="Hardware", sku="EX-001", unit_price=100.0)
    db.add(p1)
    db.flush()
    db.add(Inventory(product_id=p1.id, quantity=0, reorder_level=10))

    for d in range(30):
        tx_date = now - timedelta(days=d, hours=1)
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=100.0, transaction_date=tx_date)
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=1, unit_price=100.0))

    # 2. Dead Stock SKU: Price $50, Qty 20, 0 sales => trapped retail value $1,000, 0 daily exposure
    p2 = Product(business_id=biz.id, name="Stagnant Cable", category="Cables", sku="ST-002", unit_price=50.0)
    db.add(p2)
    db.flush()
    db.add(Inventory(product_id=p2.id, quantity=20, reorder_level=5))

    # 3. Healthy SKU: Price $20, Qty 100 (Reorder 10), 10 sales over 30 days => Low risk, 0 daily exposure
    p3 = Product(business_id=biz.id, name="Healthy Widget", category="Widgets", sku="HW-003", unit_price=20.0)
    db.add(p3)
    db.flush()
    db.add(Inventory(product_id=p3.id, quantity=100, reorder_level=10))
    for d in range(10):
        tx_date = now - timedelta(days=d, hours=1)
        tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=20.0, transaction_date=tx_date)
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p3.id, quantity=1, unit_price=20.0))

    db.commit()
    return biz


def test_sku_financial_impact_calculations(db_session: Session):
    """Verify daily revenue exposure, 7d/30d projections, and trapped retail value calculations."""
    biz = seed_financial_scenario(db_session)
    analyzer = FinancialAnalyzer(db_session)

    impacts = analyzer.get_all_sku_financial_impacts(business_id=biz.id, days=30)
    assert len(impacts) == 3

    impact_map = {s.product_name: s for s in impacts}

    # Product 1: Exposed Flagship (velocity = 1.0/day, price = $100.0, qty = 0)
    p1_impact = impact_map["Exposed Flagship"]
    assert p1_impact.is_stockout_risk is True
    assert p1_impact.sales_velocity == 1.0
    assert p1_impact.daily_revenue_exposure == 100.0
    assert p1_impact.projected_7d_revenue_exposure == 700.0
    assert p1_impact.projected_30d_revenue_exposure == 3000.0
    assert p1_impact.retail_value_on_hand == 0.0
    assert p1_impact.trapped_retail_inventory_value == 0.0

    # Product 2: Stagnant Cable (velocity = 0.0, price = $50.0, qty = 20)
    p2_impact = impact_map["Stagnant Cable"]
    assert p2_impact.is_stagnant is True
    assert p2_impact.sales_velocity == 0.0
    assert p2_impact.daily_revenue_exposure == 0.0
    assert p2_impact.projected_7d_revenue_exposure == 0.0
    assert p2_impact.retail_value_on_hand == 1000.0
    assert p2_impact.trapped_retail_inventory_value == 1000.0

    # Product 3: Healthy Widget (Low risk => 0 daily revenue exposure)
    p3_impact = impact_map["Healthy Widget"]
    assert p3_impact.is_stockout_risk is False
    assert p3_impact.daily_revenue_exposure == 0.0
    assert p3_impact.retail_value_on_hand == 2000.0


def test_business_financial_summary(db_session: Session):
    """Verify aggregated business-level revenue exposure and retail asset metrics."""
    biz = seed_financial_scenario(db_session)
    analyzer = FinancialAnalyzer(db_session)

    summary = analyzer.get_business_financial_summary(business_id=biz.id, days=30)
    assert summary.business_id == biz.id
    assert summary.total_daily_revenue_exposure == 100.0
    assert summary.projected_7d_revenue_exposure == 700.0
    assert summary.projected_30d_revenue_exposure == 3000.0
    assert summary.total_trapped_retail_inventory_value == 1000.0
    assert summary.total_retail_inventory_value_on_hand == 3000.0  # $0 + $1000 + $2000
    assert summary.financially_exposed_sku_count == 1
    assert summary.stagnant_sku_count == 1
    assert summary.total_active_sku_count == 3
    assert len(summary.impacted_skus) == 2


def test_financial_determinism_and_reproducibility(db_session: Session):
    """Verify that identical inputs produce 100% identical financial metrics across repeated runs."""
    biz = seed_financial_scenario(db_session)
    analyzer = FinancialAnalyzer(db_session)

    res1 = analyzer.get_business_financial_summary(business_id=biz.id, days=30)
    res2 = analyzer.get_business_financial_summary(business_id=biz.id, days=30)

    assert res1.model_dump() == res2.model_dump()


def test_empty_business_financial(db_session: Session):
    """Verify safe zero-state handling for business with no catalog items."""
    biz = Business(name="Zero Corp", industry="Retail")
    db_session.add(biz)
    db_session.commit()

    analyzer = FinancialAnalyzer(db_session)
    summary = analyzer.get_business_financial_summary(business_id=biz.id, days=30)

    assert summary.total_daily_revenue_exposure == 0.0
    assert summary.projected_7d_revenue_exposure == 0.0
    assert summary.total_trapped_retail_inventory_value == 0.0
    assert summary.total_retail_inventory_value_on_hand == 0.0
    assert summary.financially_exposed_sku_count == 0
    assert summary.impacted_skus == []


def test_financial_multi_business_isolation(db_session: Session):
    """Verify that financial exposures and retail asset valuations are strictly isolated per business."""
    biz1 = seed_financial_scenario(db_session)

    biz2 = Business(name="Isolated Enterprise", industry="Fashion")
    db_session.add(biz2)
    db_session.flush()

    p_biz2 = Product(business_id=biz2.id, name="Luxury Silk Scarf", category="Apparel", sku="SCARF-01", unit_price=200.0)
    db_session.add(p_biz2)
    db_session.flush()
    db_session.add(Inventory(product_id=p_biz2.id, quantity=10, reorder_level=5))
    db_session.commit()

    analyzer = FinancialAnalyzer(db_session)
    sum1 = analyzer.get_business_financial_summary(business_id=biz1.id, days=30)
    sum2 = analyzer.get_business_financial_summary(business_id=biz2.id, days=30)

    # Biz 1 has 3 SKUs, $100/d exposure, $1000 trapped, $3000 total on-hand
    assert sum1.business_id == biz1.id
    assert sum1.total_active_sku_count == 3
    assert sum1.total_daily_revenue_exposure == 100.0
    assert sum1.total_trapped_retail_inventory_value == 1000.0
    assert sum1.total_retail_inventory_value_on_hand == 3000.0

    # Biz 2 has 1 SKU, $0/d exposure (healthy stock & 0 velocity), $0 trapped (qty 10 > reorder 5 with 0 sales => trapped retail value = $2000 if stagnant), $2000 total on-hand
    assert sum2.business_id == biz2.id
    assert sum2.total_active_sku_count == 1
    assert sum2.total_daily_revenue_exposure == 0.0
    assert sum2.total_retail_inventory_value_on_hand == 2000.0
    assert all(sku.product_name != "Luxury Silk Scarf" for sku in sum1.impacted_skus)

