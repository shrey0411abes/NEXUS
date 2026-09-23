"""Sales analyzer executing database aggregations for revenue and velocity metrics."""
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Dict
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from models.business import Business
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionItem
from analytics_models import BusinessKPIs, ProductSalesMetrics

from calculators.kpi_calculator import (
    calculate_average_transaction_value,
    calculate_inventory_health_counts,
)
from calculators.velocity_calculator import (
    calculate_sales_velocity,
    calculate_average_daily_revenue,
)


class SalesAnalyzer:
    """Computes revenue, volume, and velocity metrics using SQL-side aggregations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_business_kpis(self, business_id: int, days: int = 30) -> BusinessKPIs:
        """
        Calculate aggregated core business KPIs over the given observation window.

        SQL Optimizations:
            - Aggregates transaction counts and total revenue with single SQL queries.
            - Aggregates item unit volumes via JOIN.
            - Inspects product catalog counts in a single query.
        """
        observation_days = max(1, days)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=observation_days)

        # 1. Revenue and transaction count from Transactions
        tx_query = (
            select(
                func.count(Transaction.id).label("tx_count"),
                func.coalesce(func.sum(Transaction.total_amount), 0.0).label("revenue")
            )
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= cutoff_date,
                Transaction.transaction_type == "sale"
            )
        )
        tx_result = self.db.execute(tx_query).first()
        total_tx = tx_result.tx_count if tx_result else 0
        total_rev = Decimal(str(tx_result.revenue)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if tx_result and tx_result.revenue is not None else Decimal("0.00")

        # 2. Total units sold from TransactionItems
        units_query = (
            select(func.coalesce(func.sum(TransactionItem.quantity), 0))
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= cutoff_date,
                Transaction.transaction_type == "sale"
            )
        )
        total_units = int(self.db.scalar(units_query) or 0)

        # 3. Product catalog count
        prod_count_query = select(func.count(Product.id)).where(Product.business_id == business_id)
        active_products = int(self.db.scalar(prod_count_query) or 0)

        # 4. Inventory health breakdown (low stock / out of stock)
        inv_query = (
            select(Inventory.quantity, Inventory.reorder_level)
            .join(Product, Inventory.product_id == Product.id)
            .where(Product.business_id == business_id)
        )
        inv_records = self.db.execute(inv_query).all()
        low_stock_count, out_of_stock_count = calculate_inventory_health_counts(
            [(row.quantity, row.reorder_level) for row in inv_records]
        )

        avg_tx_value = calculate_average_transaction_value(total_rev, total_tx)

        return BusinessKPIs(
            business_id=business_id,
            observation_period_days=observation_days,
            total_revenue=total_rev,
            total_transactions=total_tx,
            total_units_sold=total_units,
            average_transaction_value=avg_tx_value,
            active_products_count=active_products,
            low_stock_products_count=low_stock_count,
            out_of_stock_products_count=out_of_stock_count,
        )

    def get_product_sales_metrics(
        self,
        product_id: int,
        days: int = 30
    ) -> Optional[ProductSalesMetrics]:
        """Compute sales velocity and revenue volume for a single product."""
        product = self.db.get(Product, product_id)
        if not product:
            return None

        observation_days = max(1, days)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=observation_days)

        metrics_query = (
            select(
                func.coalesce(func.sum(TransactionItem.quantity), 0).label("units_sold"),
                func.coalesce(func.sum(TransactionItem.quantity * TransactionItem.unit_price), 0.0).label("revenue")
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                TransactionItem.product_id == product_id,
                Transaction.transaction_date >= cutoff_date,
                Transaction.transaction_type == "sale"
            )
        )
        result = self.db.execute(metrics_query).first()
        units_sold = int(result.units_sold) if result else 0
        revenue = Decimal(str(result.revenue)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if result and result.revenue is not None else Decimal("0.00")

        velocity = calculate_sales_velocity(units_sold, observation_days)
        avg_daily_rev = calculate_average_daily_revenue(revenue, observation_days)

        return ProductSalesMetrics(
            product_id=product.id,
            product_name=product.name,
            sku=product.sku,
            observation_period_days=observation_days,
            total_units_sold=units_sold,
            total_revenue=revenue,
            sales_velocity=velocity,
            average_daily_revenue=avg_daily_rev,
        )

    def get_all_product_velocities(
        self,
        business_id: int,
        days: int = 30
    ) -> Dict[int, float]:
        """
        Compute sales velocities for all products of a business in a single grouped query.
        Returns a mapping of {product_id: velocity}.
        """
        observation_days = max(1, days)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=observation_days)

        grouped_query = (
            select(
                TransactionItem.product_id,
                func.coalesce(func.sum(TransactionItem.quantity), 0).label("units_sold")
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= cutoff_date,
                Transaction.transaction_type == "sale"
            )
            .group_by(TransactionItem.product_id)
        )

        results = self.db.execute(grouped_query).all()
        sales_map = {row.product_id: int(row.units_sold) for row in results}

        # Include all products even if 0 sales
        all_products = self.db.scalars(
            select(Product.id).where(Product.business_id == business_id)
        ).all()

        return {
            pid: calculate_sales_velocity(sales_map.get(pid, 0), observation_days)
            for pid in all_products
        }
