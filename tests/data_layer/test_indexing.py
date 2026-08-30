"""
Tests for Phase 5 Database Indexing, Query Plans, Idempotency, and Equivalence.
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from database import init_db
from models import Business, Product, Inventory, Transaction, TransactionItem
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.financial_analyzer import FinancialAnalyzer


def test_expected_indexes_exist(db_session: Session):
    """Verify that all expected primary, foreign key, and composite performance indexes exist."""
    inspector = inspect(db_session.bind)

    # 1. Transactions indexes
    tx_indexes = {idx["name"]: idx for idx in inspector.get_indexes("transactions")}
    assert "ix_transactions_business_id" in tx_indexes
    assert "ix_transactions_business_date_type" in tx_indexes
    assert tx_indexes["ix_transactions_business_date_type"]["column_names"] == [
        "business_id",
        "transaction_date",
        "transaction_type",
    ]

    # 2. Products indexes
    prod_indexes = {idx["name"]: idx for idx in inspector.get_indexes("products")}
    assert "ix_products_business_id" in prod_indexes
    assert "ix_products_sku" in prod_indexes

    # 3. Transaction items indexes
    item_indexes = {idx["name"]: idx for idx in inspector.get_indexes("transaction_items")}
    assert "ix_transaction_items_transaction_id" in item_indexes
    assert "ix_transaction_items_product_id" in item_indexes

    # 4. Inventory indexes
    inv_indexes = {idx["name"]: idx for idx in inspector.get_indexes("inventories")}
    assert "ix_inventories_product_id" in inv_indexes


def test_schema_init_idempotency(db_session: Session):
    """Verify that init_db can be executed repeatedly on existing databases without error."""
    engine = db_session.bind
    # Repeated calls must succeed cleanly
    init_db(engine)
    init_db(engine)
    init_db(engine)


def test_explain_query_plan_composite_index(db_session: Session):
    """Verify via EXPLAIN QUERY PLAN that SQLite utilizes ix_transactions_business_date_type."""
    query = text("""
        EXPLAIN QUERY PLAN
        SELECT count(id), sum(total_amount)
        FROM transactions
        WHERE business_id = :b_id
          AND transaction_date >= :c_date
          AND transaction_type = 'sale'
    """)
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=30)
    result = db_session.execute(query, {"b_id": 1, "c_date": cutoff}).fetchall()

    plans = [row[3] for row in result]
    assert any("ix_transactions_business_date_type" in plan for plan in plans), f"Plan did not use composite index: {plans}"


def test_indexed_query_result_equivalence(db_session: Session):
    """Verify that business KPI, velocity, and financial calculations match exact expected values with indexes active."""
    biz = Business(name="Equivalence Test Enterprise", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(business_id=biz.id, name="Test Item", category="Cat A", sku="EQ-001", unit_price=50.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=5, reorder_level=10))

    now_utc = datetime.now(timezone.utc)
    for d in range(10):
        tx = Transaction(
            business_id=biz.id,
            transaction_type="sale",
            total_amount=50.0,
            transaction_date=now_utc - timedelta(days=d, hours=1)
        )
        db_session.add(tx)
        db_session.flush()
        db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=1, unit_price=50.0))
    db_session.commit()

    # 1. Sales KPI
    sales_analyzer = SalesAnalyzer(db_session)
    kpis = sales_analyzer.get_business_kpis(business_id=biz.id, days=30)
    assert kpis.total_revenue == 500.0
    assert kpis.total_transactions == 10
    assert kpis.total_units_sold == 10

    # 2. Product Velocity
    prod_metrics = sales_analyzer.get_product_sales_metrics(product_id=prod.id, days=30)
    assert prod_metrics is not None
    assert prod_metrics.total_units_sold == 10
    assert prod_metrics.total_revenue == 500.0
    assert prod_metrics.sales_velocity == round(10 / 30, 4)

    # 3. Financial Summary
    fin_analyzer = FinancialAnalyzer(db_session)
    fin_summary = fin_analyzer.get_business_financial_summary(business_id=biz.id, days=30)
    assert fin_summary.business_id == biz.id
    assert fin_summary.total_daily_revenue_exposure == round(prod_metrics.sales_velocity * 50.0, 2)
    assert fin_summary.total_retail_inventory_value_on_hand == 250.0  # 5 * $50
