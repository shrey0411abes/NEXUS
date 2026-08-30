"""Tests for Cross-Domain and Operational Prioritization REST API endpoints."""
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem


def test_cross_domain_api_endpoints(client: TestClient, db_session: Session):
    """Test /cross-domain/risks, /cross-domain/priorities, and /cross-domain/summary."""
    # Seed a business
    biz = Business(name="API Test Business", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(business_id=biz.id, name="Test Product", category="Tech", sku="TP-001", unit_price=25.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=1, reorder_level=10))

    # Add transaction
    tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=25.0, transaction_date=datetime.now(timezone.utc) - timedelta(days=1))
    db_session.add(tx)
    db_session.flush()
    db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=1, unit_price=25.0))
    db_session.commit()

    # 1. Test GET /api/v1/cross-domain/risks
    res = client.get(f"/api/v1/cross-domain/risks?business_id={biz.id}&days=30")
    assert res.status_code == 200
    risks = res.json()
    assert isinstance(risks, list)
    assert len(risks) == 1
    assert risks[0]["correlation_type"] in ["ACCELERATING_DEPLETION", "STOCKOUT_IMMINENT", "SURGE_STOCKOUT_SQUEEZE"]
    assert "INVENTORY" in risks[0]["affected_domains"]

    # 2. Test GET /api/v1/cross-domain/priorities
    res_p = client.get(f"/api/v1/cross-domain/priorities?business_id={biz.id}&days=30")
    assert res_p.status_code == 200
    priorities = res_p.json()
    assert isinstance(priorities, list)
    assert len(priorities) == 1
    assert priorities[0]["priority_rank"] == 1
    assert priorities[0]["priority_score"] > 0
    assert priorities[0]["source_status"] == "VERIFIED_FACT"

    # 3. Test GET /api/v1/cross-domain/summary
    res_s = client.get(f"/api/v1/cross-domain/summary?business_id={biz.id}&days=30")
    assert res_s.status_code == 200
    summary = res_s.json()
    assert summary["business_id"] == biz.id
    assert summary["correlations_count"] == 1
    assert len(summary["prioritized_queue"]) == 1

    # 4. Test 404 on nonexistent business
    res_404 = client.get("/api/v1/cross-domain/risks?business_id=99999")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()

    res_p_404 = client.get("/api/v1/cross-domain/priorities?business_id=99999")
    assert res_p_404.status_code == 404

    # 5. Test 422 on invalid parameters (e.g. days=0 or days=500)
    res_invalid = client.get(f"/api/v1/cross-domain/risks?business_id={biz.id}&days=0")
    assert res_invalid.status_code == 422

