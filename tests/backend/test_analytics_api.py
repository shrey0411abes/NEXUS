"""API endpoint tests for analytics and recommendations (auth-aware)."""
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models import Business, Product, Inventory, Transaction, TransactionItem


def _seed_analytics_data_for_business(db: Session, biz: Business) -> list:
    """Seed test analytics data for a given Business entity. Returns [p1, p2, p3]."""
    p1 = Product(business_id=biz.id, name="Thermos", category="Gear", sku="THM-01", unit_price=25.0)
    p2 = Product(business_id=biz.id, name="Backpack", category="Gear", sku="BPK-01", unit_price=60.0)
    p3 = Product(business_id=biz.id, name="Compass", category="Tools", sku="CMP-01", unit_price=15.0)
    db.add_all([p1, p2, p3])
    db.flush()

    db.add(Inventory(product_id=p1.id, quantity=5, reorder_level=10))
    db.add(Inventory(product_id=p2.id, quantity=0, reorder_level=5))
    db.add(Inventory(product_id=p3.id, quantity=50, reorder_level=10))
    db.flush()

    now = datetime.now(timezone.utc)
    for day in [2, 5, 8, 12, 16]:
        tx_date = now - timedelta(days=day)
        tx = Transaction(
            business_id=biz.id,
            transaction_type="sale",
            total_amount=50.0,
            transaction_date=tx_date,
        )
        db.add(tx)
        db.flush()
        db.add(TransactionItem(transaction_id=tx.id, product_id=p1.id, quantity=2, unit_price=25.0))

    db.commit()
    db.refresh(p1)
    db.refresh(p2)
    db.refresh(p3)
    return [p1, p2, p3]


def test_get_business_kpis_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/kpis — authenticated tenant's data."""
    # Get authenticated tenant
    me_res = client.get("/api/v1/businesses/me")
    assert me_res.status_code == 200
    biz_data = me_res.json()
    biz_id = biz_data["id"]

    # Seed data for the authenticated tenant's business
    from models import Business as BizModel
    biz = db_session.get(BizModel, biz_id)
    _seed_analytics_data_for_business(db_session, biz)

    res = client.get("/api/v1/analytics/kpis?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["business_id"] == biz_id
    assert data["total_revenue"] == 250.0
    assert data["total_transactions"] == 5
    assert data["active_products_count"] == 3


def test_get_business_kpis_not_found_without_auth(unauth_client: TestClient):
    """Test GET /api/v1/analytics/kpis returns 401 when unauthenticated."""
    res = unauth_client.get("/api/v1/analytics/kpis?days=30")
    assert res.status_code == 401


def test_get_product_sales_analytics_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/products/{id} for authenticated tenant's product."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]
    from models import Business as BizModel
    biz = db_session.get(BizModel, biz_id)
    products = _seed_analytics_data_for_business(db_session, biz)

    res = client.get(f"/api/v1/analytics/products/{products[0].id}?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["product_id"] == products[0].id
    assert "sales_velocity" in data


def test_get_inventory_risks_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/inventory-risk for authenticated tenant."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]
    from models import Business as BizModel
    biz = db_session.get(BizModel, biz_id)
    _seed_analytics_data_for_business(db_session, biz)

    res = client.get("/api/v1/analytics/inventory-risk")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3
    assert any(item["risk_level"] == "CRITICAL" for item in data)


def test_get_demand_trends_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/analytics/trends for authenticated tenant."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]
    from models import Business as BizModel
    biz = db_session.get(BizModel, biz_id)
    _seed_analytics_data_for_business(db_session, biz)

    res = client.get("/api/v1/analytics/trends?days=14")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 3


def test_get_recommendations_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/recommendations for authenticated tenant."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]
    from models import Business as BizModel
    biz = db_session.get(BizModel, biz_id)
    _seed_analytics_data_for_business(db_session, biz)

    res = client.get("/api/v1/recommendations?days=30")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert "recommendation_type" in data[0]
    assert "priority" in data[0]
    assert "title" in data[0]
