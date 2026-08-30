"""Recommendations API endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_db

from analytics_models import Recommendation

from engine import RecommendationEngine
from repositories.business_repository import BusinessRepository

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("", response_model=List[Recommendation])
def get_business_recommendations(
    business_id: int = Query(..., description="Target business ID"),
    days: int = Query(30, ge=1, le=365, description="Observation window in days for metric evaluation"),
    db: Session = Depends(get_db)
) -> List[Recommendation]:
    """
    Retrieve deterministic, prioritized business recommendations for a business.

    Evaluates stockout risks, demand momentum changes, and dead inventory conditions.
    """
    biz_repo = BusinessRepository(db)
    if not biz_repo.get_by_id(business_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business with ID {business_id} not found"
        )

    engine = RecommendationEngine(db)
    return engine.generate_recommendations(business_id=business_id, days=days)
