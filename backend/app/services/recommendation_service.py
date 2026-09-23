"""Recommendation Application Service — tenant-isolated deterministic business recommendations."""
from typing import List
from unit_of_work import AbstractUnitOfWork
from analytics_models import Recommendation
from engine import RecommendationEngine


class RecommendationService:
    """Orchestrates deterministic recommendation generation for the authenticated tenant."""

    def __init__(self, uow: AbstractUnitOfWork) -> None:
        self.uow = uow

    def get_recommendations(self, business_id: int, days: int = 30) -> List[Recommendation]:
        """
        Retrieve deterministic, prioritized business recommendations for the authenticated tenant.
        Evaluates stockout risks, demand momentum changes, and dead inventory conditions.
        """
        safe_days = min(max(1, days), 365)
        engine = RecommendationEngine(self.uow.db)
        return engine.generate_recommendations(business_id=business_id, days=safe_days)
