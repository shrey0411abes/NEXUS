"""Deterministic calculations for business Key Performance Indicators (KPIs)."""
from typing import List, Tuple, Optional


def calculate_average_transaction_value(total_revenue: float, total_transactions: int) -> float:
    """
    Calculate average revenue per transaction.

    Formula:
        ATV = total_revenue / total_transactions (if total_transactions > 0 else 0.0)

    Guarantees:
        - Never raises ZeroDivisionError
        - Returns rounded 2-decimal float
    """
    if total_transactions <= 0:
        return 0.0
    return round(total_revenue / total_transactions, 2)


def calculate_inventory_health_counts(
    inventories: List[Tuple[int, int]]  # List of (quantity, reorder_level)
) -> Tuple[int, int]:
    """
    Determine count of low-stock and out-of-stock products from inventory records.

    Definitions:
        - Out of stock: quantity <= 0
        - Low stock: 0 < quantity <= reorder_level

    Returns:
        (low_stock_count, out_of_stock_count)
    """
    low_stock = 0
    out_of_stock = 0

    for qty, reorder in inventories:
        if qty <= 0:
            out_of_stock += 1
        elif qty <= reorder:
            low_stock += 1

    return low_stock, out_of_stock
