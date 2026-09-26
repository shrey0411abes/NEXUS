"""
Tests for Product Catalog Completion: PATCH update, soft-archival, RBAC, and history preservation.
Phase 3A.1: Data Integrity + Product Foundation.

Verifies:
1. PATCH updates: name, category, SKU, price.
2. Duplicate tenant SKU returns 409 Conflict.
3. Unchanged SKU succeeds.
4. Cross-tenant product update returns 404 Not Found.
5. MEMBER PATCH returns 403 Forbidden.
6. OWNER PATCH succeeds.
7. ADMIN PATCH succeeds.
8. Archive sets is_active=False.
9. Repeated archive remains archived safely (idempotent).
10. MEMBER archive returns 403 Forbidden.
11. Cross-tenant archive returns 404 Not Found.
12. Default product listing excludes archived products.
13. include_archived=True includes archived products.
14. GET /products/{id} continues returning archived product.
15. Historical transaction referencing archived product remains valid and retrievable.
"""
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from models import Business, User, Product, Inventory, Transaction, TransactionItem


def _provision_tenant_with_roles(db: Session, biz_name: str = "Catalog Corp") -> dict:
    """Provision a tenant with OWNER, ADMIN, MEMBER, and seed products."""
    biz = Business(name=biz_name, industry="Hardware")
    db.add(biz)
    db.flush()

    safe_name = biz_name.lower().replace(" ", "").replace("-", "")
    owner = User(
        business_id=biz.id,
        email=f"owner@{safe_name}.test",
        password_hash=hash_password("Pass123!Safe"),
        role="OWNER",
        is_active=True,
    )
    admin = User(
        business_id=biz.id,
        email=f"admin@{safe_name}.test",
        password_hash=hash_password("Pass123!Safe"),
        role="ADMIN",
        is_active=True,
    )
    member = User(
        business_id=biz.id,
        email=f"member@{safe_name}.test",
        password_hash=hash_password("Pass123!Safe"),
        role="MEMBER",
        is_active=True,
    )
    db.add_all([owner, admin, member])
    db.commit()

    owner_token = create_access_token(subject=str(owner.id), business_id=biz.id, role="OWNER")
    admin_token = create_access_token(subject=str(admin.id), business_id=biz.id, role="ADMIN")
    member_token = create_access_token(subject=str(member.id), business_id=biz.id, role="MEMBER")

    p1 = Product(business_id=biz.id, name="Sensor Alpha", category="Sensors", sku=f"SKU-{safe_name}-01", unit_price=Decimal("49.99"))
    p2 = Product(business_id=biz.id, name="Sensor Beta", category="Sensors", sku=f"SKU-{safe_name}-02", unit_price=Decimal("79.99"))
    db.add_all([p1, p2])
    db.flush()

    inv1 = Inventory(product_id=p1.id, quantity=50, reorder_level=10)
    inv2 = Inventory(product_id=p2.id, quantity=30, reorder_level=5)
    db.add_all([inv1, inv2])
    db.commit()

    return {
        "biz": biz,
        "owner": owner,
        "admin": admin,
        "member": member,
        "owner_token": owner_token,
        "admin_token": admin_token,
        "member_token": member_token,
        "p1": p1,
        "p2": p2,
    }


def test_product_patch_update_attributes_owner(db_session: Session, auth_client_factory):
    """OWNER can update name, category, SKU, and unit_price via PATCH."""
    ctx = _provision_tenant_with_roles(db_session, "Patch Store")
    client = auth_client_factory(ctx["owner_token"])

    update_payload = {
        "name": "Sensor Alpha Pro",
        "category": "Industrial Sensors",
        "sku": "SKU-ALPHA-PRO",
        "unit_price": 59.99,
    }
    resp = client.patch(f"/api/v1/products/{ctx['p1'].id}", json=update_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Sensor Alpha Pro"
    assert data["category"] == "Industrial Sensors"
    assert data["sku"] == "SKU-ALPHA-PRO"
    assert Decimal(str(data["unit_price"])) == Decimal("59.99")
    assert data["is_active"] is True


def test_product_patch_update_admin_allowed(db_session: Session, auth_client_factory):
    """ADMIN role can update product catalog attributes."""
    ctx = _provision_tenant_with_roles(db_session, "Admin Store")
    client = auth_client_factory(ctx["admin_token"])

    resp = client.patch(f"/api/v1/products/{ctx['p1'].id}", json={"name": "Sensor By Admin"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Sensor By Admin"


def test_product_patch_member_forbidden(db_session: Session, auth_client_factory):
    """MEMBER role receives HTTP 403 when attempting PATCH update."""
    ctx = _provision_tenant_with_roles(db_session, "Member Store")
    client = auth_client_factory(ctx["member_token"])

    resp = client.patch(f"/api/v1/products/{ctx['p1'].id}", json={"name": "Hacked By Member"})
    assert resp.status_code == 403
    assert "Operation requires one of the following roles: OWNER, ADMIN" in resp.json()["detail"]


def test_product_patch_unchanged_sku_succeeds(db_session: Session, auth_client_factory):
    """Submitting the same existing SKU does not trigger a duplicate conflict."""
    ctx = _provision_tenant_with_roles(db_session, "Same SKU Store")
    client = auth_client_factory(ctx["owner_token"])

    resp = client.patch(f"/api/v1/products/{ctx['p1'].id}", json={"sku": ctx["p1"].sku, "name": "Renamed Same SKU"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Same SKU"


def test_product_patch_duplicate_sku_conflict(db_session: Session, auth_client_factory):
    """Updating SKU to match an existing product in the same tenant returns 409 Conflict."""
    ctx = _provision_tenant_with_roles(db_session, "Dup SKU Store")
    client = auth_client_factory(ctx["owner_token"])

    # Attempt to change p1's SKU to p2's SKU
    resp = client.patch(f"/api/v1/products/{ctx['p1'].id}", json={"sku": ctx["p2"].sku})
    assert resp.status_code == 409
    assert f"Product with SKU '{ctx['p2'].sku}' already exists" in resp.json()["detail"]


def test_product_patch_cross_tenant_returns_404(db_session: Session, auth_client_factory):
    """Attempting to update another tenant's product returns 404 (IDOR prevention)."""
    ctx_a = _provision_tenant_with_roles(db_session, "Store A")
    ctx_b = _provision_tenant_with_roles(db_session, "Store B")

    client_a = auth_client_factory(ctx_a["owner_token"])
    resp = client_a.patch(f"/api/v1/products/{ctx_b['p1'].id}", json={"name": "Attacking Store B"})
    assert resp.status_code == 404


def test_product_archive_lifecycle_owner_and_admin(db_session: Session, auth_client_factory):
    """OWNER and ADMIN can soft-archive a product."""
    ctx = _provision_tenant_with_roles(db_session, "Archive Store")
    client_admin = auth_client_factory(ctx["admin_token"])

    resp = client_admin.post(f"/api/v1/products/{ctx['p1'].id}/archive")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_product_archive_idempotent(db_session: Session, auth_client_factory):
    """Archiving an already archived product succeeds safely and remains archived."""
    ctx = _provision_tenant_with_roles(db_session, "Idempotent Archive Store")
    client = auth_client_factory(ctx["owner_token"])

    resp1 = client.post(f"/api/v1/products/{ctx['p1'].id}/archive")
    assert resp1.status_code == 200
    assert resp1.json()["is_active"] is False

    resp2 = client.post(f"/api/v1/products/{ctx['p1'].id}/archive")
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is False


def test_product_archive_member_forbidden(db_session: Session, auth_client_factory):
    """MEMBER receives 403 Forbidden when attempting to archive."""
    ctx = _provision_tenant_with_roles(db_session, "Member Archive Store")
    client = auth_client_factory(ctx["member_token"])

    resp = client.post(f"/api/v1/products/{ctx['p1'].id}/archive")
    assert resp.status_code == 403


def test_product_archive_cross_tenant_returns_404(db_session: Session, auth_client_factory):
    """Cross-tenant product archive returns 404 Not Found."""
    ctx_a = _provision_tenant_with_roles(db_session, "Store A Arch")
    ctx_b = _provision_tenant_with_roles(db_session, "Store B Arch")

    client_a = auth_client_factory(ctx_a["owner_token"])
    resp = client_a.post(f"/api/v1/products/{ctx_b['p1'].id}/archive")
    assert resp.status_code == 404


def test_product_listing_default_excludes_archived(db_session: Session, auth_client_factory):
    """GET /products excludes archived products by default."""
    ctx = _provision_tenant_with_roles(db_session, "Listing Filter Store")
    client = auth_client_factory(ctx["owner_token"])

    # Archive p1
    client.post(f"/api/v1/products/{ctx['p1'].id}/archive")

    # Default listing (include_archived=False)
    resp = client.get("/api/v1/products")
    assert resp.status_code == 200
    items = resp.json()
    item_ids = [item["id"] for item in items]
    assert ctx["p1"].id not in item_ids
    assert ctx["p2"].id in item_ids


def test_product_listing_include_archived_true(db_session: Session, auth_client_factory):
    """GET /products?include_archived=true includes both active and archived products."""
    ctx = _provision_tenant_with_roles(db_session, "Listing All Store")
    client = auth_client_factory(ctx["owner_token"])

    # Archive p1
    client.post(f"/api/v1/products/{ctx['p1'].id}/archive")

    # Listing with include_archived=True
    resp = client.get("/api/v1/products?include_archived=true")
    assert resp.status_code == 200
    items = resp.json()
    item_ids = [item["id"] for item in items]
    assert ctx["p1"].id in item_ids
    assert ctx["p2"].id in item_ids

    p1_data = next(i for i in items if i["id"] == ctx["p1"].id)
    assert p1_data["is_active"] is False


def test_product_get_by_id_returns_archived_product(db_session: Session, auth_client_factory):
    """GET /products/{id} returns product even if archived (historical query preservation)."""
    ctx = _provision_tenant_with_roles(db_session, "Get Archive Store")
    client = auth_client_factory(ctx["owner_token"])

    client.post(f"/api/v1/products/{ctx['p1'].id}/archive")

    resp = client.get(f"/api/v1/products/{ctx['p1'].id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == ctx["p1"].id
    assert resp.json()["is_active"] is False


def test_historical_transaction_with_archived_product_remains_valid(db_session: Session, auth_client_factory):
    """Historical transactions referencing an archived product remain completely intact."""
    ctx = _provision_tenant_with_roles(db_session, "History Tx Store")
    client = auth_client_factory(ctx["owner_token"])

    # Record transaction referencing p1
    tx_payload = {
        "business_id": ctx["biz"].id,
        "transaction_type": "sale",
        "items": [
            {"product_id": ctx["p1"].id, "quantity": 2, "unit_price": 49.99},
        ]
    }
    tx_resp = client.post("/api/v1/transactions", json=tx_payload)
    assert tx_resp.status_code == 201
    tx_id = tx_resp.json()["id"]

    # Archive p1
    arch_resp = client.post(f"/api/v1/products/{ctx['p1'].id}/archive")
    assert arch_resp.status_code == 200

    # Retrieve transaction -> still contains p1 line item with intact data
    get_tx_resp = client.get(f"/api/v1/transactions/{tx_id}")
    assert get_tx_resp.status_code == 200
    tx_data = get_tx_resp.json()
    assert len(tx_data["items"]) == 1
    assert tx_data["items"][0]["product_id"] == ctx["p1"].id
    assert Decimal(str(tx_data["total_amount"])) == Decimal("99.98")
