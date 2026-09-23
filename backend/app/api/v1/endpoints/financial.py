"""
Financial Intelligence & Revenue Exposure API Endpoints — tenant-isolated (Phase 4A).

Exposes deterministic daily revenue exposure, projected multi-day exposure,
and trapped retail inventory asset valuations.
"""
from typing import List
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_uow, get_current_active_business
from app.services.financial_service import FinancialService
from unit_of_work import SqlAlchemyUnitOfWork
from financial_models import SKUFinancialImpact, BusinessFinancialSummary
from models.business import Business

router = APIRouter(prefix="/financial", tags=["Financial Intelligence"])


@router.get("/impact", response_model=List[SKUFinancialImpact])
def get_sku_financial_impacts(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[SKUFinancialImpact]:
    """
    Phase 4A: Retrieve deterministic financial impact metrics for all catalog SKUs via FinancialService.
    Calculates daily revenue exposure ($/day) and trapped retail inventory asset value ($).
    Scoped exclusively to the authenticated tenant.
    """
    service = FinancialService(uow)
    return service.get_sku_impacts(business_id=current_business.id, days=days)


@router.get("/summary", response_model=BusinessFinancialSummary)
def get_business_financial_summary(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> BusinessFinancialSummary:
    """
    Phase 4A: Retrieve aggregated business-level revenue exposure and retail valuation summary via FinancialService.
    Includes total daily exposure, 7-day and 30-day projections, and trapped retail value.
    Scoped exclusively to the authenticated tenant.
    """
    service = FinancialService(uow)
    return service.get_summary(business_id=current_business.id, days=days)
