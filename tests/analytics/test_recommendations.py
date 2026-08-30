"""Tests for recommendation engine decision logic."""
from sqlalchemy.orm import Session
from engine import RecommendationEngine
from tests.analytics.test_analyzers import setup_sample_business_data


def test_recommendation_engine_generates_urgent_reorders(db_session: Session):
    """Verify engine generates urgent reorder recommendations for critical stock."""
    biz = setup_sample_business_data(db_session)
    engine = RecommendationEngine(db_session)

    recommendations = engine.generate_recommendations(biz.id, days=30)
    assert len(recommendations) >= 1

    # Should have a critical reorder recommendation for BPK-01 (0 stock)
    critical_recs = [r for r in recommendations if r.priority == "CRITICAL"]
    assert len(critical_recs) >= 1
    assert any("Backpack" in r.title for r in critical_recs)
    assert critical_recs[0].recommendation_type == "REORDER_URGENT"
