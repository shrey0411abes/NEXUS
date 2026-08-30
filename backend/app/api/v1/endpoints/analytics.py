"""Analytics API endpoints exposing deterministic business intelligence."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db

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
from repositories.business_repository import BusinessRepository
from repositories.product_repository import ProductRepository

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/kpis", response_model=BusinessKPIs)
def get_business_kpis(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db)
) -> BusinessKPIs:
    """Retrieve aggregated core KPIs for a business over an observation window."""
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )

    analyzer = SalesAnalyzer(db)
    return analyzer.get_business_kpis(business_id=business_id, days=days)


@router.get("/products/{product_id}", response_model=ProductSalesMetrics)
def get_product_sales_analytics(
    product_id: int,
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db)
) -> ProductSalesMetrics:
    """Retrieve sales velocity and volume metrics for an individual product."""
    analyzer = SalesAnalyzer(db)
    metrics = analyzer.get_product_sales_metrics(product_id=product_id, days=days)
    if not metrics:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    return metrics


@router.get("/inventory-risk", response_model=List[StockRiskIndicator])
def get_inventory_risks(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window for velocity"),
    db: Session = Depends(get_db)
) -> List[StockRiskIndicator]:
    """Retrieve deterministic stockout risk indicators for all catalog items of a business."""
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )

    analyzer = InventoryAnalyzer(db)
    return analyzer.get_stock_risk_indicators(business_id=business_id, days=days)


@router.get("/trends", response_model=List[DemandTrend])
def get_demand_trends(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(14, ge=1, le=180, description="Window size in days for period comparison"),
    db: Session = Depends(get_db)
) -> List[DemandTrend]:
    """Retrieve demand trend momentum comparing recent vs prior contiguous windows."""
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )

    analyzer = TrendAnalyzer(db)
    return analyzer.get_demand_trends(business_id=business_id, window_days=days)


@router.get("/anomalies", response_model=List[DailySalesAnomaly])
def get_sales_anomalies(
    business_id: int = Query(..., description="Target business ID"),
    product_id: Optional[int] = Query(None, description="Optional specific product ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db)
) -> List[DailySalesAnomaly]:
    """Retrieve daily sales volume anomaly flags."""
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )

    if product_id is not None:
        prod_repo = ProductRepository(db)
        if not prod_repo.get_by_id(product_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {product_id} not found"
            )

    analyzer = TrendAnalyzer(db)
    return analyzer.get_daily_sales_anomalies(business_id=business_id, product_id=product_id, days=days)
