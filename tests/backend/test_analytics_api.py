"""API endpoint tests for analytics and recommendations."""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from tests.analytics.test_analyzers import setup_sample_business_data


def test_get_business_kpis_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/kpis with valid business."""
    biz = setup_sample_business_data(db_session)

    res = client.get(f"/api/v1/analytics/kpis?business_id={biz.id}&days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"] == biz.id
    assert data["total_revenue"] == 250.0
    assert data["total_transactions"] == 5
    assert data["active_products_count"] == 3


def test_get_business_kpis_not_found(client: TestClient):
    """Test GET /api/v1/analytics/kpis returns 404 for non-existent business."""
    res = client.get("/api/v1/analytics/kpis?business_id=99999")
    assert res.status_code == 404


def test_get_product_sales_analytics_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/products/{id}."""
    biz = setup_sample_business_data(db_session)
    prod = biz.products[0]

    res = client.get(f"/api/v1/analytics/products/{prod.id}?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["product_id"] == prod.id
    assert "sales_velocity" in data


def test_get_inventory_risks_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/inventory-risk."""
    biz = setup_sample_business_data(db_session)

    res = client.get(f"/api/v1/analytics/inventory-risk?business_id={biz.id}")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3
    assert any(item["risk_level"] == "CRITICAL" for item in data)


def test_get_demand_trends_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/trends."""
    biz = setup_sample_business_data(db_session)

    res = client.get(f"/api/v1/analytics/trends?business_id={biz.id}&days=14")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3


def test_get_recommendations_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/recommendations."""
    biz = setup_sample_business_data(db_session)

    res = client.get(f"/api/v1/recommendations?business_id={biz.id}&days=30")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert "recommendation_type" in data[0]
    assert "priority" in data[0]
    assert "title" in data[0]
