"""
Cross-Domain Risk Correlation & Operational Risk Prioritization API Endpoints.
Phase 3A & Phase 3B.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db

from correlation_models import (
    CrossDomainRiskCorrelation,
    PrioritizedRiskAction,
    CrossDomainAnalysisResult,
)
from cross_domain_engine import CrossDomainEngine
from repositories.business_repository import BusinessRepository

router = APIRouter(prefix="/cross-domain", tags=["Cross-Domain Intelligence"])


@router.get("/risks", response_model=List[CrossDomainRiskCorrelation])
def get_cross_domain_risks(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
) -> List[CrossDomainRiskCorrelation]:
    """
    Phase 3A: Retrieve verified cross-domain risk correlations for a business.
    Deterministically evaluates collisions between inventory, sales momentum, and anomalies.
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found",
        )

    engine = CrossDomainEngine(db)
    return engine.analyze_cross_domain_risks(business_id=business_id, days=days)


@router.get("/priorities", response_model=List[PrioritizedRiskAction])
def get_operational_risk_priorities(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
) -> List[PrioritizedRiskAction]:
    """
    Phase 3B: Retrieve prioritized operational risk queue answering 'What requires attention now, and why?'.
    Deterministic priority scoring and ranking based on real database metrics.
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found",
        )

    engine = CrossDomainEngine(db)
    return engine.prioritize_operational_risks(business_id=business_id, days=days)


@router.get("/summary", response_model=CrossDomainAnalysisResult)
def get_cross_domain_summary(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    db: Session = Depends(get_db),
) -> CrossDomainAnalysisResult:
    """
    Phase 3A/3B: Complete cross-domain analysis result containing correlations and prioritized action queue.
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found",
        )

    engine = CrossDomainEngine(db)
    return engine.get_complete_analysis(business_id=business_id, days=days)
