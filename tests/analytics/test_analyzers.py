"""Integration tests for Sales, Inventory, and Trend analyzers against test database."""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from models import Business, Product, Inventory, Transaction, TransactionItem
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer


def setup_sample_business_data(db: Session) -> Business:
    """Helper to populate isolated business and transaction records."""
    biz = Business(name="Nordic Goods", industry="Retail")
    db.add(biz)
    db.flush()

    # Products
    p1 = Product(business_id=biz.id, name="Thermos", category="Gear", sku="THM-01", unit_price=25.0)
    p2 = Product(business_id=biz.id, name="Backpack", category="Gear", sku="BPK-01", unit_price=60.0)
    p3 = Product(business_id=biz.id, name="Compass", category="Tools", sku="CMP-01", unit_price=15.0)
    db.add_all([p1, p2, p3])
    db.flush()

    # Inventory
    inv1 = Inventory(product_id=p1.id, quantity=5, reorder_level=10)   # Low stock
    inv2 = Inventory(product_id=p2.id, quantity=0, reorder_level=5)    # Out of stock
    inv3 = Inventory(product_id=p3.id, quantity=50, reorder_level=10)  # Healthy
    db.add_all([inv1, inv2, inv3])
    db.flush()

    # Transactions across past 20 days
    now = datetime.now(timezone.utc)
    for day in [2, 5, 8, 12, 16]:
        tx_date = now - timedelta(days=day)
        tx = Transaction(
            business_id=biz.id,
            transaction_type="sale",
            total_amount=50.0,
            transaction_date=tx_date
        )
        db.add(tx)
        db.flush()
        # Item: 2 units of p1 ($25 each)
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=2, unit_price=25.0))

    db.commit()
    return biz


def test_sales_analyzer_kpis(db_session: Session):
    """Verify aggregated business KPIs over 30-day window."""
    biz = setup_sample_business_data(db_session)
    analyzer = SalesAnalyzer(db_session)

    kpis = analyzer.get_business_kpis(biz.id, days=30)
    assert kpis.business_id == biz.id
    assert kpis.total_transactions == 5
    assert kpis.total_revenue == 250.0
    assert kpis.total_units_sold == 10
    assert kpis.average_transaction_value == 50.0
    assert kpis.active_products_count == 3
    assert kpis.low_stock_products_count == 1
    assert kpis.out_of_stock_products_count == 1


def test_sales_analyzer_product_velocity(db_session: Session):
    """Verify product-level velocity calculations."""
    biz = setup_sample_business_data(db_session)
    analyzer = SalesAnalyzer(db_session)

    p1 = db_session.query(Product).filter(Product.sku == "THM-01").first()
    metrics = analyzer.get_product_sales_metrics(p1.id, days=30)

    assert metrics is not None
    assert metrics.total_units_sold == 10
    assert metrics.sales_velocity == round(10 / 30, 4)


def test_inventory_analyzer_metrics_and_risks(db_session: Session):
    """Verify inventory metrics and risk level assignments."""
    biz = setup_sample_business_data(db_session)
    analyzer = InventoryAnalyzer(db_session)

    risks = analyzer.get_stock_risk_indicators(biz.id, days=30)
    assert len(risks) == 3

    risk_map = {r.sku: r.risk_level for r in risks}
    assert risk_map["BPK-01"] == "CRITICAL"  # 0 stock
    assert risk_map["THM-01"] in ["HIGH", "CRITICAL"]  # 5 units with active velocity


def test_trend_analyzer_demand_trends(db_session: Session):
    """Verify demand trends across comparative windows."""
    biz = setup_sample_business_data(db_session)
    analyzer = TrendAnalyzer(db_session)

    trends = analyzer.get_demand_trends(biz.id, window_days=10)
    assert len(trends) == 3
    for trend in trends:
        assert trend.trend_direction in ["INCREASING", "STABLE", "DECREASING", "INSUFFICIENT_DATA"]
