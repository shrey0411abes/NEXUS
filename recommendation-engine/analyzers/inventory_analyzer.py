"""Inventory analyzer combining stock positions with sales velocities."""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from models.product import Product
from models.inventory import Inventory
from analytics_models import InventoryMetrics, StockRiskIndicator

from analyzers.sales_analyzer import SalesAnalyzer
from calculators.coverage_calculator import (
    calculate_days_of_inventory,
    classify_inventory_status,
)
from calculators.risk_calculator import evaluate_stockout_risk


class InventoryAnalyzer:
    """Evaluates stock coverage, low stock conditions, and deterministic stockout risks."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.sales_analyzer = SalesAnalyzer(db)

    def get_inventory_metrics(
        self,
        business_id: int,
        days: int = 30
    ) -> List[InventoryMetrics]:
        """Compute inventory coverage and status for all products of a business."""
        velocities = self.sales_analyzer.get_all_product_velocities(business_id, days=days)

        stmt = (
            select(Product, Inventory)
            .join(Inventory, Product.id == Inventory.product_id)
            .where(Product.business_id == business_id)
            .order_by(Product.id.asc())
        )
        records = self.db.execute(stmt).all()

        results: List[InventoryMetrics] = []
        for product, inventory in records:
            velocity = velocities.get(product.id, 0.0)
            coverage = calculate_days_of_inventory(inventory.quantity, velocity)
            status = classify_inventory_status(
                inventory.quantity,
                inventory.reorder_level,
                coverage
            )

            results.append(
                InventoryMetrics(
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku,
                    current_quantity=inventory.quantity,
                    reorder_level=inventory.reorder_level,
                    sales_velocity=velocity,
                    days_of_inventory=coverage,
                    is_low_stock=(0 < inventory.quantity <= inventory.reorder_level),
                    is_out_of_stock=(inventory.quantity <= 0),
                    stock_status=status,
                )
            )

        return results

    def get_stock_risk_indicators(
        self,
        business_id: int,
        days: int = 30
    ) -> List[StockRiskIndicator]:
        """Compute deterministic stockout risk indicators for all products."""
        inv_metrics = self.get_inventory_metrics(business_id, days=days)

        risk_list: List[StockRiskIndicator] = []
        for metric in inv_metrics:
            risk_level, reasons = evaluate_stockout_risk(
                current_quantity=metric.current_quantity,
                reorder_level=metric.reorder_level,
                sales_velocity=metric.sales_velocity,
                days_of_inventory=metric.days_of_inventory,
            )

            risk_list.append(
                StockRiskIndicator(
                    product_id=metric.product_id,
                    product_name=metric.product_name,
                    sku=metric.sku,
                    risk_level=risk_level,
                    current_quantity=metric.current_quantity,
                    reorder_level=metric.reorder_level,
                    days_of_inventory=metric.days_of_inventory,
                    risk_reasons=reasons,
                )
            )

        # Sort with most critical risks first
        priority_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INSUFFICIENT_DATA": 4}
        risk_list.sort(key=lambda r: priority_order.get(r.risk_level, 99))
        return risk_list
