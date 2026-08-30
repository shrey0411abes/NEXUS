"""Deterministic calculations for inventory coverage and stock status."""
from typing import Optional, Tuple


def calculate_days_of_inventory(
    current_quantity: int,
    sales_velocity: float
) -> Optional[float]:
    """
    Calculate estimated days of inventory coverage remaining.

    Formula:
        days_of_inventory = current_quantity / sales_velocity (if sales_velocity > 0)

    Domain Rules:
        - If current_quantity <= 0: returns 0.0 days.
        - If sales_velocity <= 0 and current_quantity > 0:
            Returns None (representing infinite or undefined duration due to no sales velocity).
        - Returns float rounded to 1 decimal place when velocity > 0.
    """
    if current_quantity <= 0:
        return 0.0
    if sales_velocity <= 0.0:
        return None
    return round(current_quantity / sales_velocity, 1)


def classify_inventory_status(
    current_quantity: int,
    reorder_level: int,
    days_of_inventory: Optional[float]
) -> str:
    """
    Classify inventory health state.

    Statuses:
        - OUT_OF_STOCK: quantity <= 0
        - LOW_STOCK: 0 < quantity <= reorder_level
        - OVERSTOCKED: days_of_inventory > 60.0 or (quantity > reorder_level * 5 and velocity is zero)
        - NORMAL: healthy inventory
    """
    if current_quantity <= 0:
        return "OUT_OF_STOCK"
    if current_quantity <= reorder_level:
        return "LOW_STOCK"
    if days_of_inventory is not None and days_of_inventory > 60.0:
        return "OVERSTOCKED"
    return "NORMAL"
