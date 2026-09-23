"""Recommendations API endpoints — tenant-isolated."""
from typing import List
from fastapi import APIRouter, Depends, Query

from app.api.deps import get_uow, get_current_active_business
from app.services.recommendation_service import RecommendationService
from unit_of_work import SqlAlchemyUnitOfWork
from analytics_models import Recommendation
from models.business import Business

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("", response_model=List[Recommendation])
def get_business_recommendations(
    days: int = Query(30, ge=1, le=365, description="Observation window in days for metric evaluation"),
    current_business: Business = Depends(get_current_active_business),
    uow: SqlAlchemyUnitOfWork = Depends(get_uow),
) -> List[Recommendation]:
    """
    Retrieve deterministic, prioritized business recommendations for the authenticated tenant via RecommendationService.
    Evaluates stockout risks, demand momentum changes, and dead inventory conditions.
    """
    service = RecommendationService(uow)
    return service.get_recommendations(business_id=current_business.id, days=days)
