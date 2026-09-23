"""Analytics API endpoints — tenant-isolated, exposing deterministic business intelligence."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_uow, get_current_active_business
from app.services.analytics_service import AnalyticsService
from unit_of_work import SqlAlchemyUnitOfWork
from models.business import Business
from analytics_models import (
    BusinessKPIs,
    ProductSalesMetrics,
    StockRiskIndicator,
    DemandTrend,
    DailySalesAnomaly,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/kpis", response_model=BusinessKPIs)
def get_business_kpis(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> BusinessKPIs:
    """Retrieve aggregated core KPIs for the authenticated business tenant via AnalyticsService."""
    service = AnalyticsService(uow)
    return service.get_business_kpis(business_id=current_business.id, days=days)


@router.get("/products/{product_id}", response_model=ProductSalesMetrics)
def get_product_sales_analytics(
    product_id: int,
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> ProductSalesMetrics:
    """
    Retrieve sales metrics for an individual product via AnalyticsService.
    Product must belong to the authenticated tenant.
    """
    service = AnalyticsService(uow)
    return service.get_product_sales_analytics(
        business_id=current_business.id, product_id=product_id, days=days
    )


@router.get("/inventory-risk", response_model=List[StockRiskIndicator])
def get_inventory_risks(
    days: int = Query(30, ge=1, le=365, description="Observation window for velocity"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[StockRiskIndicator]:
    """Retrieve deterministic stockout risk indicators for the authenticated tenant via AnalyticsService."""
    service = AnalyticsService(uow)
    return service.get_inventory_risks(business_id=current_business.id, days=days)


@router.get("/trends", response_model=List[DemandTrend])
def get_demand_trends(
    days: int = Query(14, ge=1, le=180, description="Window size in days for period comparison"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[DemandTrend]:
    """Retrieve demand trend momentum for the authenticated tenant via AnalyticsService."""
    service = AnalyticsService(uow)
    return service.get_demand_trends(business_id=current_business.id, days=days)


@router.get("/anomalies", response_model=List[DailySalesAnomaly])
def get_sales_anomalies(
    product_id: Optional[int] = Query(None, description="Optional specific product ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[DailySalesAnomaly]:
    """
    Retrieve daily sales volume anomaly flags for the authenticated tenant via AnalyticsService.
    Optional product_id filter is verified against the authenticated tenant.
    """
    service = AnalyticsService(uow)
    return service.get_sales_anomalies(
        business_id=current_business.id, product_id=product_id, days=days
    )
