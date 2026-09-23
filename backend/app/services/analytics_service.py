"""Analytics Application Service — tenant-isolated deterministic business intelligence."""
from typing import List, Optional
from fastapi import HTTPException, status

from unit_of_work import AbstractUnitOfWork
from analytics_models import (
    BusinessKPIs,
    ProductSalesMetrics,
    StockRiskIndicator,
    DemandTrend,
    DailySalesAnomaly,
)
from analyzers.sales_analyzer import SalesAnalyzer
from analyzers.inventory_analyzer import InventoryAnalyzer
from analyzers.trend_analyzer import TrendAnalyzer


class AnalyticsService:
    """Orchestrates deterministic analytics computations for the authenticated tenant."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_business_kpis(self, business_id: int, days: int = 30) -> BusinessKPIs:
        """Retrieve aggregated core KPIs for the authenticated business tenant."""
        safe_days = min(max(1, days), 365)
        analyzer = SalesAnalyzer(self.uow.db)
        return analyzer.get_business_kpis(business_id=business_id, days=safe_days)

    def get_product_sales_analytics(
        self,
        business_id: int,
        product_id: int,
        days: int = 30,
    ) -> ProductSalesMetrics:
        """
        Retrieve sales metrics for an individual product, strictly validating tenant ownership.
        """
        safe_days = min(max(1, days), 365)
        product = self.uow.products.get_for_business(product_id=product_id, business_id=business_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )

        analyzer = SalesAnalyzer(self.uow.db)
        metrics = analyzer.get_product_sales_metrics(product_id=product_id, days=safe_days)
        if not metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found",
            )
        return metrics

    def get_inventory_risks(self, business_id: int, days: int = 30) -> List[StockRiskIndicator]:
        """Retrieve deterministic stockout risk indicators for the authenticated tenant."""
        safe_days = min(max(1, days), 365)
        analyzer = InventoryAnalyzer(self.uow.db)
        return analyzer.get_stock_risk_indicators(business_id=business_id, days=safe_days)

    def get_demand_trends(self, business_id: int, days: int = 14) -> List[DemandTrend]:
        """Retrieve demand trend momentum for the authenticated tenant."""
        safe_days = min(max(1, days), 180)
        analyzer = TrendAnalyzer(self.uow.db)
        return analyzer.get_demand_trends(business_id=business_id, window_days=safe_days)

    def get_sales_anomalies(
        self,
        business_id: int,
        product_id: Optional[int] = None,
        days: int = 30,
    ) -> List[DailySalesAnomaly]:
        """
        Retrieve daily sales volume anomaly flags for the authenticated tenant.
        Optional product_id filter is verified against tenant ownership.
        """
        safe_days = min(max(1, days), 365)
        if product_id is not None:
            product = self.uow.products.get_for_business(product_id=product_id, business_id=business_id)
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product with ID {product_id} not found",
                )

        analyzer = TrendAnalyzer(self.uow.db)
        return analyzer.get_daily_sales_anomalies(
            business_id=business_id, product_id=product_id, days=safe_days
        )
