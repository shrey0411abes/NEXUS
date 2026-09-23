"""Tests for Backend API v1 persistence endpoints (auth-aware)."""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from models import Business, Product


def test_my_business_api(client: TestClient, db_session: Session):
    """Test GET /api/v1/businesses/me returns the authenticated tenant's business."""
    res = client.get("/api/v1/businesses/me")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] is not None
    assert data["name"] == "Test Business"
    biz_id = data["id"]

    # GET /{business_id} returns own business
    get_res = client.get(f"/api/v1/businesses/{biz_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Test Business"

    # GET /{wrong_id} returns 404 (IDOR protection)
    get_bad = client.get("/api/v1/businesses/99999")
    assert get_bad.status_code == 404


def test_products_and_inventory_api(client: TestClient, db_session: Session):
    """Test POST /api/v1/products, GET /api/v1/products, GET /api/v1/inventory using authenticated tenant."""
    # Get our authenticated tenant's business ID
    me_res = client.get("/api/v1/businesses/me")
    assert me_res.status_code == 200
    biz_id = me_res.json()["id"]

    # Create product — business_id in payload is overridden by auth; we still send it for schema compliance
    prod_payload = {
        "business_id": biz_id,
        "name": "Red Rose Bouquet",
        "category": "Flowers",
        "sku": "ROSE-RED-01",
        "unit_price": 35.0,
        "initial_quantity": 40,
        "reorder_level": 10
    }
    prod_res = client.post("/api/v1/products", json=prod_payload)
    assert prod_res.status_code == 201
    prod_data = prod_res.json()
    prod_id = prod_data["id"]
    assert prod_data["inventory"]["quantity"] == 40

    # Get product list — no business_id param needed (uses auth tenant)
    prod_list_res = client.get("/api/v1/products")
    assert prod_list_res.status_code == 200
    assert len(prod_list_res.json()) == 1

    # Check inventory endpoint
    inv_res = client.get("/api/v1/inventory")
    assert inv_res.status_code == 200
    assert len(inv_res.json()) >= 1

    # Check single inventory by product id
    single_inv_res = client.get(f"/api/v1/inventory/{prod_id}")
    assert single_inv_res.status_code == 200
    assert single_inv_res.json()["quantity"] == 40

    # Update inventory (OWNER can do this)
    patch_res = client.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 25})
    assert patch_res.status_code == 200
    assert patch_res.json()["quantity"] == 25


def test_product_sku_conflict_returns_409(client: TestClient, db_session: Session):
    """Verify that posting a duplicate SKU returns 409 Conflict."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]

    prod_payload = {
        "business_id": biz_id,
        "name": "Espresso",
        "category": "Beverage",
        "sku": "BEV-ESP-01",
        "unit_price": 3.0,
        "initial_quantity": 100,
        "reorder_level": 20
    }
    res1 = client.post("/api/v1/products", json=prod_payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/products", json=prod_payload)
    assert res2.status_code == 409


def test_transactions_api_lifecycle(client: TestClient, db_session: Session):
    """Test POST /api/v1/transactions and GET /api/v1/transactions."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]

    prod_res = client.post("/api/v1/products", json={
        "business_id": biz_id,
        "name": "Python Guide",
        "category": "Tech",
        "sku": "BK-PY-01",
        "unit_price": 40.0,
        "initial_quantity": 20
    })
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Post transaction — business_id in payload is overridden by auth
    tx_payload = {
        "business_id": biz_id,
        "transaction_type": "sale",
        "items": [
            {"product_id": prod_id, "quantity": 2, "unit_price": 40.0}
        ]
    }
    tx_res = client.post("/api/v1/transactions", json=tx_payload)
    assert tx_res.status_code == 201
    tx_data = tx_res.json()
    assert tx_data["total_amount"] == 80.0
    assert len(tx_data["items"]) == 1

    # Get transaction by ID
    get_tx_res = client.get(f"/api/v1/transactions/{tx_data['id']}")
    assert get_tx_res.status_code == 200
    assert get_tx_res.json()["total_amount"] == 80.0


def test_cross_business_transaction_rejected_by_api(client: TestClient, db_session: Session):
    """
    Verify that a transaction item referencing a product from another tenant is rejected.
    Seeds Biz B's product directly in DB. Biz A (authenticated) tries to reference it.
    """
    # Seed a second business and product directly in DB (bypassing API)
    biz_b = Business(name="Business Two", industry="Retail")
    db_session.add(biz_b)
    db_session.flush()

    prod_b = Product(
        business_id=biz_b.id,
        name="Product of Biz B",
        category="Tech",
        sku="PROD-B",
        unit_price=50.0,
    )
    db_session.add(prod_b)
    db_session.commit()
    db_session.refresh(prod_b)

    # Get authenticated tenant (Biz A)
    me_res = client.get("/api/v1/businesses/me")
    biz_a_id = me_res.json()["id"]

    # Transaction under Biz A referencing Product of Biz B
    tx_res = client.post("/api/v1/transactions", json={
        "business_id": biz_a_id,
        "transaction_type": "sale",
        "items": [
            {"product_id": prod_b.id, "quantity": 1, "unit_price": 50.0}
        ]
    })
    assert tx_res.status_code == 400
    assert "Cross-business product mismatch" in tx_res.json()["detail"]
