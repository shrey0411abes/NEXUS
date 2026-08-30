"""Tests for Phase 4A Financial Intelligence REST API endpoints."""
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem


def test_financial_api_endpoints(client: TestClient, db_session: Session):
    """Test /financial/impact and /financial/summary endpoints."""
    # Seed a business with an exposed product
    biz = Business(name="Financial API Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    prod = Product(business_id=biz.id, name="At-Risk Item", category="Electronics", sku="AR-001", unit_price=50.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=0, reorder_level=10))

    # Add transaction
    tx = Transaction(business_id=biz.id, transaction_type="sale", total_amount=100.0, transaction_date=datetime.now(timezone.utc) - timedelta(days=1))
    db_session.add(tx)
    db_session.flush()
    db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=2, unit_price=50.0))
    db_session.commit()

    # 1. Test GET /api/v1/financial/impact
    res_i = client.get(f"/api/v1/financial/impact?business_id={biz.id}&days=30")
    assert res_i.status_code == 200
    impacts = res_i.json()
    assert isinstance(impacts, list)
    assert len(impacts) == 1
    assert impacts[0]["product_name"] == "At-Risk Item"
    assert impacts[0]["daily_revenue_exposure"] > 0
    assert impacts[0]["source_status"] == "VERIFIED_FACT"

    # 2. Test GET /api/v1/financial/summary
    res_s = client.get(f"/api/v1/financial/summary?business_id={biz.id}&days=30")
    assert res_s.status_code == 200
    summary = res_s.json()
    assert summary["business_id"] == biz.id
    assert summary["total_daily_revenue_exposure"] > 0
    assert "cost_basis_disclaimer" in summary
    assert "projection_disclaimer" in summary
    assert len(summary["impacted_skus"]) == 1

    # 3. Test 404 on nonexistent business
    res_404 = client.get("/api/v1/financial/summary?business_id=99999")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()

    # 4. Test 422 on invalid observation window
    res_422 = client.get(f"/api/v1/financial/summary?business_id={biz.id}&days=0")
    assert res_422.status_code == 422
