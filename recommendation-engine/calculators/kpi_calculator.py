"""Deterministic calculations for business Key Performance Indicators (KPIs)."""
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple, Union


def calculate_average_transaction_value(total_revenue: Union[Decimal, float], total_transactions: int) -> Decimal:
    """
    Calculate average revenue per transaction.

    Formula:
        ATV = total_revenue / total_transactions (if total_transactions > 0 else Decimal('0.00'))

    Guarantees:
        - Never raises ZeroDivisionError
        - Returns Decimal rounded to 2 decimal places using ROUND_HALF_UP
    """
    if total_transactions <= 0:
        return Decimal("0.00")
    rev = Decimal(str(total_revenue)) if not isinstance(total_revenue, Decimal) else total_revenue
    return (rev / Decimal(str(total_transactions))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
