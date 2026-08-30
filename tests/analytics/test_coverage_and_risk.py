"""Tests for inventory coverage and stockout risk calculations."""
from calculators.coverage_calculator import (
    calculate_days_of_inventory,
    classify_inventory_status,
)
from calculators.risk_calculator import evaluate_stockout_risk


def test_days_of_inventory_positive_velocity():
    """Verify coverage days when velocity > 0."""
    days = calculate_days_of_inventory(current_quantity=60, sales_velocity=2.0)
    assert days == 30.0


def test_days_of_inventory_zero_velocity_with_stock():
    """Verify coverage returns None (undefined/infinite) when velocity is 0 and stock exists."""
    days = calculate_days_of_inventory(current_quantity=50, sales_velocity=0.0)
    assert days is None


def test_days_of_inventory_zero_stock():
    """Verify coverage returns 0.0 when stock is 0."""
    days = calculate_days_of_inventory(current_quantity=0, sales_velocity=5.0)
    assert days == 0.0


def test_classify_inventory_status():
    """Verify inventory status classifications."""
    assert classify_inventory_status(0, 10, 0.0) == "OUT_OF_STOCK"
    assert classify_inventory_status(8, 10, 4.0) == "LOW_STOCK"
    assert classify_inventory_status(100, 10, 75.0) == "OVERSTOCKED"
    assert classify_inventory_status(30, 10, 15.0) == "NORMAL"


def test_stockout_risk_critical_out_of_stock():
    """Verify CRITICAL risk when quantity <= 0."""
    risk, reasons = evaluate_stockout_risk(
        current_quantity=0,
        reorder_level=10,
        sales_velocity=2.0,
        days_of_inventory=0.0
    )
    assert risk == "CRITICAL"
    assert len(reasons) > 0


def test_stockout_risk_critical_days():
    """Verify CRITICAL risk when days of inventory <= 2.0."""
    risk, reasons = evaluate_stockout_risk(
        current_quantity=4,
        reorder_level=10,
        sales_velocity=2.5,
        days_of_inventory=1.6
    )
    assert risk == "CRITICAL"


def test_stockout_risk_high():
    """Verify HIGH risk when days of inventory <= 7.0."""
    risk, reasons = evaluate_stockout_risk(
        current_quantity=15,
        reorder_level=10,
        sales_velocity=3.0,
        days_of_inventory=5.0
    )
    assert risk == "HIGH"


def test_stockout_risk_medium():
    """Verify MEDIUM risk when days of inventory <= 14.0."""
    risk, reasons = evaluate_stockout_risk(
        current_quantity=20,
        reorder_level=10,
        sales_velocity=2.0,
        days_of_inventory=10.0
    )
    assert risk == "MEDIUM"


def test_stockout_risk_low():
    """Verify LOW risk when coverage > 14 days and stock > reorder level."""
    risk, reasons = evaluate_stockout_risk(
        current_quantity=100,
        reorder_level=10,
        sales_velocity=2.0,
        days_of_inventory=50.0
    )
    assert risk == "LOW"
