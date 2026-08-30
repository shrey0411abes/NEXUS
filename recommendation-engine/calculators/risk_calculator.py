"""Deterministic stockout risk assessment calculator."""
from typing import List, Optional, Tuple

# Explicit, configurable threshold constants for stockout risk heuristics
CRITICAL_DAYS_THRESHOLD = 2.0   # <= 2 days of stock remaining
HIGH_DAYS_THRESHOLD = 7.0       # <= 7 days of stock remaining
MEDIUM_DAYS_THRESHOLD = 14.0    # <= 14 days of stock remaining


def evaluate_stockout_risk(
    current_quantity: int,
    reorder_level: int,
    sales_velocity: float,
    days_of_inventory: Optional[float]
) -> Tuple[str, List[str]]:
    """
    Evaluate deterministic stockout risk level and generate explicit reasons.

    Classifications:
        - CRITICAL:
            - Product is currently completely out of stock (quantity <= 0)
            - OR inventory coverage is <= 2.0 days
        - HIGH:
            - Inventory coverage is <= 7.0 days
            - OR stock is at or below reorder level with active velocity
        - MEDIUM:
            - Inventory coverage is <= 14.0 days
            - OR stock is at or below reorder level with low/zero velocity
        - LOW:
            - Inventory coverage is > 14.0 days and stock is above reorder level
        - INSUFFICIENT_DATA:
            - No stock deficit and zero historical sales data

    Returns:
        (risk_level, list_of_reasons)
    """
    reasons: List[str] = []

    # 1. Out of stock check
    if current_quantity <= 0:
        reasons.append("Product is completely out of stock (0 on-hand quantity).")
        return "CRITICAL", reasons

    # 2. Critical coverage threshold
    if days_of_inventory is not None and days_of_inventory <= CRITICAL_DAYS_THRESHOLD:
        reasons.append(
            f"Critical stockout risk: Estimated {days_of_inventory:.1f} days of inventory remaining at velocity of {sales_velocity:.2f} units/day."
        )
        return "CRITICAL", reasons

    # 3. High risk
    if days_of_inventory is not None and days_of_inventory <= HIGH_DAYS_THRESHOLD:
        reasons.append(
            f"High stockout risk: Estimated {days_of_inventory:.1f} days of inventory remaining (below 7-day safe buffer)."
        )
        return "HIGH", reasons

    if current_quantity <= reorder_level and sales_velocity > 0:
        reasons.append(
            f"High risk: Stock level ({current_quantity}) is below reorder threshold ({reorder_level}) with active sales velocity ({sales_velocity:.2f} units/day)."
        )
        return "HIGH", reasons

    # 4. Medium risk
    if days_of_inventory is not None and days_of_inventory <= MEDIUM_DAYS_THRESHOLD:
        reasons.append(
            f"Medium risk: Estimated {days_of_inventory:.1f} days of inventory remaining (below 14-day standard replenishment cycle)."
        )
        return "MEDIUM", reasons

    if current_quantity <= reorder_level:
        reasons.append(
            f"Medium risk: Stock level ({current_quantity}) is at/below reorder threshold ({reorder_level}), but sales velocity is currently low."
        )
        return "MEDIUM", reasons

    # 5. Low risk / Healthy
    if days_of_inventory is not None and days_of_inventory > MEDIUM_DAYS_THRESHOLD:
        reasons.append(
            f"Low risk: Healthy inventory coverage of {days_of_inventory:.1f} days."
        )
        return "LOW", reasons

    # 6. No velocity data but healthy quantity
    reasons.append("Low risk: On-hand quantity is above reorder threshold with no immediate demand pressure.")
    return "LOW", reasons
