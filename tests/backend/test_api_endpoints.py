"""Tests for Backend API v1 persistence endpoints."""
from fastapi.testclient import TestClient


def test_businesses_api_crud(client: TestClient):
    """Test POST /api/v1/businesses and GET /api/v1/businesses."""
    # Create business
    post_res = client.post(
        "/api/v1/businesses",
        json={"name": "Summit Retail", "industry": "Outdoor Gear"}
    )
    assert post_res.status_code == 201
    biz_data = post_res.json()
    assert biz_data["id"] is not None
    assert biz_data["name"] == "Summit Retail"
    biz_id = biz_data["id"]

    # Get businesses list
    list_res = client.get("/api/v1/businesses")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Get single business
    get_res = client.get(f"/api/v1/businesses/{biz_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Summit Retail"


def test_products_and_inventory_api(client: TestClient):
    """Test POST /api/v1/products, GET /api/v1/products, GET /api/v1/inventory."""
    # Create business first
    biz_res = client.post("/api/v1/businesses", json={"name": "Flora Shop", "industry": "Florist"})
    biz_id = biz_res.json()["id"]

    # Create product with inventory
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

    # Get product list
    prod_list_res = client.get(f"/api/v1/products?business_id={biz_id}")
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

    # Update inventory
    patch_res = client.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 25})
    assert patch_res.status_code == 200
    assert patch_res.json()["quantity"] == 25


def test_product_sku_conflict_returns_409(client: TestClient):
    """Verify that posting a duplicate SKU returns 409 Conflict."""
    biz_res = client.post("/api/v1/businesses", json={"name": "Cafe Corner", "industry": "Food"})
    biz_id = biz_res.json()["id"]

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


def test_transactions_api_lifecycle(client: TestClient):
    """Test POST /api/v1/transactions and GET /api/v1/transactions."""
    # Setup business and product
    biz_res = client.post("/api/v1/businesses", json={"name": "Bookstore", "industry": "Books"})
    biz_id = biz_res.json()["id"]

    prod_res = client.post("/api/v1/products", json={
        "business_id": biz_id,
        "name": "Python Guide",
        "category": "Tech",
        "sku": "BK-PY-01",
        "unit_price": 40.0,
        "initial_quantity": 20
    })
    prod_id = prod_res.json()["id"]

    # Post transaction
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


def test_cross_business_transaction_rejected_by_api(client: TestClient):
    """Verify that posting a transaction with a product from another business returns 400 Bad Request."""
    biz1_res = client.post("/api/v1/businesses", json={"name": "Business One", "industry": "Retail"})
    biz2_res = client.post("/api/v1/businesses", json={"name": "Business Two", "industry": "Retail"})
    biz1_id = biz1_res.json()["id"]
    biz2_id = biz2_res.json()["id"]

    prod2_res = client.post("/api/v1/products", json={
        "business_id": biz2_id,
        "name": "Product of Biz 2",
        "category": "Tech",
        "sku": "PROD-2",
        "unit_price": 50.0,
        "initial_quantity": 20
    })
    prod2_id = prod2_res.json()["id"]

    # Transaction under Biz 1 referencing Product of Biz 2
    tx_res = client.post("/api/v1/transactions", json={
        "business_id": biz1_id,
        "transaction_type": "sale",
        "items": [
            {"product_id": prod2_id, "quantity": 1, "unit_price": 50.0}
        ]
    })
    assert tx_res.status_code == 400
    assert "Cross-business product mismatch" in tx_res.json()["detail"]

