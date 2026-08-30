"""
Financial Intelligence & Revenue Exposure API Endpoints (Phase 4A).

Exposes deterministic daily revenue exposure, projected multi-day exposure,
and trapped retail inventory asset valuations.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db

from financial_models import SKUFinancialImpact, BusinessFinancialSummary
from analyzers.financial_analyzer import FinancialAnalyzer
from repositories.business_repository import BusinessRepository

router = APIRouter(prefix="/financial", tags=["Financial Intelligence"])


@router.get("/impact", response_model=List[SKUFinancialImpact])
def get_sku_financial_impacts(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
) -> List[SKUFinancialImpact]:
    """
    Phase 4A: Retrieve deterministic financial impact metrics for all catalog SKUs.
    Calculates daily revenue exposure ($/day) and trapped retail inventory asset value ($).
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found",
        )

    analyzer = FinancialAnalyzer(db)
    return analyzer.get_all_sku_financial_impacts(business_id=business_id, days=days)


@router.get("/summary", response_model=BusinessFinancialSummary)
def get_business_financial_summary(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
) -> BusinessFinancialSummary:
    """
    Phase 4A: Retrieve aggregated business-level revenue exposure and retail valuation summary.
    Includes total daily exposure, 7-day and 30-day projections, and trapped retail value.
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found",
        )

    analyzer = FinancialAnalyzer(db)
    return analyzer.get_business_financial_summary(business_id=business_id, days=days)
