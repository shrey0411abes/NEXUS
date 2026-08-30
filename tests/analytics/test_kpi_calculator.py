"""Tests for KPI math and safe arithmetic."""
from calculators.kpi_calculator import (
    calculate_average_transaction_value,
    calculate_inventory_health_counts,
)


def test_average_transaction_value_normal():
    """Verify ATV with standard revenue and transaction count."""
    atv = calculate_average_transaction_value(1500.0, 10)
    assert atv == 150.0


def test_average_transaction_value_zero_transactions():
    """Verify ATV handles zero transactions safely without ZeroDivisionError."""
    atv = calculate_average_transaction_value(0.0, 0)
    assert atv == 0.0


def test_average_transaction_value_fractional():
    """Verify ATV rounds to 2 decimal places."""
    atv = calculate_average_transaction_value(100.0, 3)
    assert atv == 33.33


def test_inventory_health_counts():
    """Verify categorization of low stock, out of stock, and normal stock."""
    # (quantity, reorder_level)
    inventories = [
        (0, 10),    # out of stock
        (-2, 5),    # out of stock
        (5, 10),    # low stock
        (10, 10),   # low stock (boundary)
        (25, 10),   # normal
        (100, 15),  # normal
    ]
    low_stock, out_of_stock = calculate_inventory_health_counts(inventories)
    assert out_of_stock == 2
    assert low_stock == 2
