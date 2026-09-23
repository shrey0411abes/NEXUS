"""
Tests for Phase P1 Monetary Precision Hardening and Decimal Arithmetic (ROUND_HALF_UP).
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem
from repositories.product_repository import ProductRepository
from repositories.transaction_repository import TransactionRepository
from schemas.product import ProductCreate, ProductResponse
from schemas.transaction import TransactionCreate, TransactionItemCreate, TransactionResponse
from calculators.kpi_calculator import calculate_average_transaction_value
from calculators.velocity_calculator import calculate_average_daily_revenue
from analyzers.financial_analyzer import FinancialAnalyzer
from analyzers.sales_analyzer import SalesAnalyzer


def test_floating_point_imprecision_vs_decimal():
    """Verify that Decimal arithmetic eliminates IEEE 754 floating-point drift."""
    # Classical float drift demonstration
    float_sum = 0.1 + 0.2
    assert float_sum != 0.3  # 0.30000000000000004 in IEEE 754

    # Decimal exactness
    decimal_sum = Decimal("0.10") + Decimal("0.20")
    assert decimal_sum == Decimal("0.30")


def test_product_repository_decimal_storage(db_session: Session):
    """Verify that ProductRepository stores and retrieves exact Decimal unit prices."""
    biz = Business(name="Precision Retail", industry="Hardware")
    db_session.add(biz)
    db_session.commit()

    repo = ProductRepository(db_session)
    prod_in = ProductCreate(
        business_id=biz.id,
        name="Precision Sensor",
        category="Sensors",
        sku="SENS-01",
        unit_price=Decimal("19.99"),
        initial_quantity=50,
        reorder_level=10,
    )
    product = repo.create(prod_in)

    fetched = repo.get_by_id(product.id)
    assert fetched is not None
    assert fetched.unit_price == Decimal("19.99")
    assert isinstance(fetched.unit_price, Decimal)


def test_transaction_repository_exact_total_calculation(db_session: Session):
    """Verify that TransactionRepository computes line item subtotals and total_amount using Decimal arithmetic."""
    biz = Business(name="Precision Store", industry="Retail")
    db_session.add(biz)
    db_session.commit()

    p1 = Product(business_id=biz.id, name="Item A", category="Cat", sku="ITM-A", unit_price=Decimal("19.99"))
    p2 = Product(business_id=biz.id, name="Item B", category="Cat", sku="ITM-B", unit_price=Decimal("0.33"))
    p3 = Product(business_id=biz.id, name="Item C", category="Cat", sku="ITM-C", unit_price=Decimal("14.50"))
    db_session.add_all([p1, p2, p3])
    db_session.commit()

    repo = TransactionRepository(db_session)
    tx_in = TransactionCreate(
        business_id=biz.id,
        transaction_type="sale",
        total_amount=None,  # Auto-calculate
        items=[
            TransactionItemCreate(product_id=p1.id, quantity=3, unit_price=Decimal("19.99")),  # 59.97
            TransactionItemCreate(product_id=p2.id, quantity=7, unit_price=Decimal("0.33")),   # 2.31
            TransactionItemCreate(product_id=p3.id, quantity=2, unit_price=Decimal("14.50")),  # 29.00
        ]
    )
    tx = repo.create(tx_in)
    expected_total = Decimal("59.97") + Decimal("2.31") + Decimal("29.00")  # Exactly Decimal("91.28")
    assert tx.total_amount == expected_total
    assert isinstance(tx.total_amount, Decimal)


def test_round_half_up_financial_quantization():
    """Verify explicit ROUND_HALF_UP rounding at monetary boundaries."""
    # Half-way values should round UP to nearest cent
    val1 = Decimal("10.005").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert val1 == Decimal("10.01")

    val2 = Decimal("10.004").quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert val2 == Decimal("10.00")

    # Average transaction value uses ROUND_HALF_UP
    atv = calculate_average_transaction_value(Decimal("100.00"), 3)
    assert atv == Decimal("33.33")

    # Average daily revenue uses ROUND_HALF_UP
    adr = calculate_average_daily_revenue(Decimal("500.00"), 30)
    assert adr == Decimal("16.67")


def test_financial_analyzer_decimal_accuracy(db_session: Session):
    """Verify that FinancialAnalyzer computes exposure and valuations with Decimal precision."""
    biz = Business(name="Financial Hardening Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(
        business_id=biz.id,
        name="Surge Widget",
        category="Widgets",
        sku="WIDG-SURGE",
        unit_price=Decimal("129.99"),
    )
    db_session.add(prod)
    db_session.flush()

    # Stockout risk condition: 2 units left, reorder 20
    db_session.add(Inventory(product_id=prod.id, quantity=2, reorder_level=20))

    # Add transactions generating known velocity
    # 30 units sold over 30 days = 1.0 unit/day velocity
    tx = Transaction(
        business_id=biz.id,
        transaction_type="sale",
        total_amount=Decimal("3899.70"),
    )
    db_session.add(tx)
    db_session.flush()
    db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=30, unit_price=Decimal("129.99")))
    db_session.commit()

    analyzer = FinancialAnalyzer(db_session)
    impacts = analyzer.get_all_sku_financial_impacts(business_id=biz.id, days=30)
    assert len(impacts) == 1

    item = impacts[0]
    assert item.unit_price == Decimal("129.99")
    assert item.retail_value_on_hand == Decimal("259.98")  # 2 * 129.99
    assert item.daily_revenue_exposure == Decimal("129.99")  # 1.0 * 129.99
    assert item.projected_7d_revenue_exposure == Decimal("909.93")  # 7 * 129.99
    assert item.projected_30d_revenue_exposure == Decimal("3899.70")  # 30 * 129.99

    summary = analyzer.get_business_financial_summary(business_id=biz.id, days=30)
    assert summary.total_daily_revenue_exposure == Decimal("129.99")
    assert summary.projected_7d_revenue_exposure == Decimal("909.93")
    assert summary.projected_30d_revenue_exposure == Decimal("3899.70")
    assert summary.total_retail_inventory_value_on_hand == Decimal("259.98")


def test_pydantic_schema_decimal_and_json_compatibility():
    """Verify that Pydantic schemas accept Decimals and serialize correctly for REST APIs."""
    prod_resp = ProductResponse(
        id=1,
        business_id=1,
        name="Test Item",
        category="Cat",
        sku="TEST-SKU",
        unit_price=Decimal("49.99"),
        created_at="2026-08-31T10:00:00Z",
    )
    # Python domain holds Decimal
    assert prod_resp.unit_price == Decimal("49.99")
    assert isinstance(prod_resp.unit_price, Decimal)

    # JSON dump emits float for frontend compatibility
    json_data = prod_resp.model_dump(mode="json")
    assert json_data["unit_price"] == 49.99
    assert isinstance(json_data["unit_price"], float)
