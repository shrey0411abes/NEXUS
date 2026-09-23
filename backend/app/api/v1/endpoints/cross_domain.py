"""
Cross-Domain Risk Correlation & Operational Risk Prioritization API Endpoints — tenant-isolated.
Phase 3A, Phase 3B, and M5-S4 Risk Actioning.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_uow, get_current_user, get_current_active_business, require_role
from app.services.cross_domain_service import CrossDomainService
from unit_of_work import SqlAlchemyUnitOfWork
from correlation_models import (
    CrossDomainRiskCorrelation,
    PrioritizedRiskAction,
    CrossDomainAnalysisResult,
)
from models.business import Business
from models.user import User
from schemas.risk_action import RiskActionCreate, RiskActionResponse

router = APIRouter(prefix="/cross-domain", tags=["Cross-Domain Intelligence"])


@router.get("/risks", response_model=List[CrossDomainRiskCorrelation])
def get_cross_domain_risks(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[CrossDomainRiskCorrelation]:
    """
    Phase 3A: Retrieve verified cross-domain risk correlations for the authenticated tenant via CrossDomainService.
    Deterministically evaluates collisions between inventory, sales momentum, and anomalies.
    """
    service = CrossDomainService(uow)
    return service.get_risks(business_id=current_business.id, days=days)


@router.get("/priorities", response_model=List[PrioritizedRiskAction])
def get_operational_risk_priorities(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    include_resolved: bool = Query(False, description="Whether to include resolved and dismissed risks"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[PrioritizedRiskAction]:
    """
    Phase 3B: Retrieve prioritized operational risk queue for the authenticated tenant via CrossDomainService.
    Reconciles ephemeral risk scoring with persistent lifecycle actions (suppressing active cooldowns unless include_resolved is True).
    """
    service = CrossDomainService(uow)
    return service.get_priorities(
        business_id=current_business.id,
        days=days,
        include_resolved=include_resolved,
    )


@router.get("/summary", response_model=CrossDomainAnalysisResult)
def get_cross_domain_summary(
    days: int = Query(30, ge=1, le=365, description="Observation window in days"),
    include_resolved: bool = Query(False, description="Whether to include resolved and dismissed risks"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> CrossDomainAnalysisResult:
    """
    Phase 3A/3B: Complete cross-domain analysis for the authenticated tenant via CrossDomainService —
    correlations and prioritized action queue.
    """
    service = CrossDomainService(uow)
    return service.get_summary(
        business_id=current_business.id,
        days=days,
        include_resolved=include_resolved,
    )


@router.post("/actions", response_model=RiskActionResponse, status_code=status.HTTP_201_CREATED)
def record_risk_action(
    action_in: RiskActionCreate,
    current_user: User = Depends(require_role(["OWNER", "ADMIN"])),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> RiskActionResponse:
    """
    Record an immutable operational risk state transition (ACKNOWLEDGED, RESOLVED, DISMISSED)
    with actor audit metadata and point-in-time metrics.
    Restricted to OWNER and ADMIN roles.
    """
    service = CrossDomainService(uow)
    return service.record_action(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action_in=action_in,
    )


@router.get("/actions", response_model=List[RiskActionResponse])
def get_risk_actions(
    state: Optional[str] = Query(None, description="Filter by operational state"),
    product_id: Optional[int] = Query(None, description="Filter by product ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    current_user: User = Depends(get_current_user),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[RiskActionResponse]:
    """
    Retrieve the persistent audit history of risk action transitions for the authenticated tenant.
    Available to all authenticated tenant members (OWNER, ADMIN, MEMBER).
    """
    service = CrossDomainService(uow)
    return service.get_actions(
        business_id=current_user.business_id,
        state=state,
        product_id=product_id,
        limit=limit,
        offset=offset,
    )

