"""Trend and anomaly analyzer using deterministic time-window comparison."""
import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Tuple
from sqlalchemy import select, func, cast, Date
from sqlalchemy.orm import Session

from models.product import Product
from models.transaction import Transaction, TransactionItem
from analytics_models import DemandTrend, DailySalesAnomaly



class TrendAnalyzer:
    """Calculates demand momentum and daily volume anomalies deterministically."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_demand_trends(
        self,
        business_id: int,
        window_days: int = 14,
        tolerance: float = 0.05
    ) -> List[DemandTrend]:
        """
        Compare sales volume across two equal, contiguous time windows:
        - Recent period: [now - window_days, now]
        - Prior period: [now - 2*window_days, now - window_days]

        Trend Classification:
            - INCREASING: percentage_change > tolerance (or recent > 0 when prior == 0)
            - DECREASING: percentage_change < -tolerance
            - STABLE: abs(percentage_change) <= tolerance
            - INSUFFICIENT_DATA: No sales in either period and product created very recently
        """
        effective_window = max(1, window_days)
        now_utc = datetime.now(timezone.utc)
        recent_start = now_utc - timedelta(days=effective_window)
        prior_start = now_utc - timedelta(days=2 * effective_window)

        # 1. Fetch all products for the business
        products = self.db.scalars(
            select(Product).where(Product.business_id == business_id).order_by(Product.id.asc())
        ).all()

        if not products:
            return []

        # 2. Query units sold in recent window grouped by product
        recent_stmt = (
            select(
                TransactionItem.product_id,
                func.coalesce(func.sum(TransactionItem.quantity), 0).label("units")
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= recent_start,
                Transaction.transaction_type == "sale"
            )
            .group_by(TransactionItem.product_id)
        )
        recent_map = {row.product_id: int(row.units) for row in self.db.execute(recent_stmt).all()}

        # 3. Query units sold in prior window grouped by product
        prior_stmt = (
            select(
                TransactionItem.product_id,
                func.coalesce(func.sum(TransactionItem.quantity), 0).label("units")
            )
            .join(Transaction, TransactionItem.transaction_id == Transaction.id)
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= prior_start,
                Transaction.transaction_date < recent_start,
                Transaction.transaction_type == "sale"
            )
            .group_by(TransactionItem.product_id)
        )
        prior_map = {row.product_id: int(row.units) for row in self.db.execute(prior_stmt).all()}

        trends: List[DemandTrend] = []
        for prod in products:
            recent_units = recent_map.get(prod.id, 0)
            prior_units = prior_map.get(prod.id, 0)

            recent_avg = round(recent_units / effective_window, 4)
            prior_avg = round(prior_units / effective_window, 4)

            pct_change: Optional[float] = None
            if prior_avg > 0:
                pct_change = round((recent_avg - prior_avg) / prior_avg, 4)
                if pct_change > tolerance:
                    direction = "INCREASING"
                elif pct_change < -tolerance:
                    direction = "DECREASING"
                else:
                    direction = "STABLE"
            else:
                if recent_avg > 0:
                    pct_change = 1.0  # +100% new momentum
                    direction = "INCREASING"
                else:
                    pct_change = 0.0
                    direction = "STABLE"

            trends.append(
                DemandTrend(
                    product_id=prod.id,
                    product_name=prod.name,
                    sku=prod.sku,
                    window_days=effective_window,
                    recent_avg_daily_sales=recent_avg,
                    prior_avg_daily_sales=prior_avg,
                    percentage_change=pct_change,
                    trend_direction=direction,
                )
            )

        return trends

    def get_daily_sales_anomalies(
        self,
        business_id: int,
        product_id: Optional[int] = None,
        days: int = 30,
        z_threshold: float = 2.0
    ) -> List[DailySalesAnomaly]:
        """
        Evaluate statistical anomalies in daily sales volume using mean and standard deviation.

        Classification:
            - SPIKE: z-score >= +z_threshold
            - DROP: z-score <= -z_threshold
            - NORMAL: abs(z) < z_threshold
            - INSUFFICIENT_DATA: Fewer than 5 daily observations
        """
        observation_days = max(1, days)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=observation_days)

        # Group sales by date string
        stmt = (
            select(
                func.date(Transaction.transaction_date).label("tx_day"),
                func.sum(TransactionItem.quantity).label("daily_units")
            )
            .join(TransactionItem, Transaction.id == TransactionItem.transaction_id)
            .where(
                Transaction.business_id == business_id,
                Transaction.transaction_date >= cutoff_date,
                Transaction.transaction_type == "sale"
            )
        )
        if product_id is not None:
            stmt = stmt.where(TransactionItem.product_id == product_id)

        stmt = stmt.group_by(func.date(Transaction.transaction_date)).order_by(func.date(Transaction.transaction_date).asc())
        daily_records = self.db.execute(stmt).all()

        if len(daily_records) < 5:
            # Transparently return insufficient data state
            return [
                DailySalesAnomaly(
                    product_id=product_id,
                    date=str(row.tx_day),
                    units_sold=int(row.daily_units),
                    mean_daily_units=0.0,
                    std_dev=0.0,
                    z_score=None,
                    anomaly_type="INSUFFICIENT_DATA",
                )
                for row in daily_records
            ]

        # Calculate sample mean and standard deviation
        volumes = [float(row.daily_units) for row in daily_records]
        n = len(volumes)
        mean_val = sum(volumes) / n
        variance = sum((x - mean_val) ** 2 for x in volumes) / (n - 1)
        std_dev = math.sqrt(variance)

        anomalies: List[DailySalesAnomaly] = []
        for row in daily_records:
            units = int(row.daily_units)
            if std_dev > 0:
                z = round((units - mean_val) / std_dev, 2)
                if z >= z_threshold:
                    anom_type = "SPIKE"
                elif z <= -z_threshold:
                    anom_type = "DROP"
                else:
                    anom_type = "NORMAL"
            else:
                z = 0.0
                anom_type = "NORMAL"

            anomalies.append(
                DailySalesAnomaly(
                    product_id=product_id,
                    date=str(row.tx_day),
                    units_sold=units,
                    mean_daily_units=round(mean_val, 2),
                    std_dev=round(std_dev, 2),
                    z_score=z,
                    anomaly_type=anom_type,
                )
            )

        return anomalies
