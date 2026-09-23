"""
M4-S4: RBAC Harmonization & Authorization Consistency — Focused Test Suite.

Verifies that mutating business-data endpoints consistently enforce the
project's established OWNER/ADMIN authorization policy:

  POST /api/v1/products
  POST /api/v1/transactions

Covers:
  - Unauthenticated -> 401
  - Authenticated MEMBER attempting OWNER/ADMIN-only mutation -> 403
  - Authenticated ADMIN -> success (201)
  - Authenticated OWNER -> success (201)
  - Tenant isolation: authenticated user is strictly bound to their own business

Also verifies regression consistency:
  - PATCH /api/v1/inventory/{product_id} retains its established authorization behavior
    (OWNER->200, ADMIN->200, MEMBER->403, unauthenticated->401).
  - MEMBER read access to GET endpoints is preserved.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from models import Business, User, Product, Inventory


# ---------------------------------------------------------------------------
# Shared Setup
# ---------------------------------------------------------------------------

def _provision_tenant_with_roles(db: Session, biz_name: str = "M4S4 Corp") -> dict:
    """
    Provision a single business with OWNER, ADMIN, and MEMBER users,
    plus one seed product with inventory. Returns a context dict.
    """
    biz = Business(name=biz_name, industry="Retail")
    db.add(biz)
    db.flush()

    safe_name = biz_name.lower().replace(" ", "").replace("-", "")
    owner = User(
        business_id=biz.id,
        email=f"owner@{safe_name}.m4s4.test",
        password_hash=hash_password("StrongPass123"),
        role="OWNER",
        is_active=True,
    )
    admin = User(
        business_id=biz.id,
        email=f"admin@{safe_name}.m4s4.test",
        password_hash=hash_password("StrongPass123"),
        role="ADMIN",
        is_active=True,
    )
    member = User(
        business_id=biz.id,
        email=f"member@{safe_name}.m4s4.test",
        password_hash=hash_password("StrongPass123"),
        role="MEMBER",
        is_active=True,
    )
    db.add_all([owner, admin, member])
    db.flush()

    seed_product = Product(
        business_id=biz.id,
        name="Seed SKU",
        category="General",
        sku=f"SEED-{biz.id:04d}",
        unit_price=10.0,
    )
    db.add(seed_product)
    db.flush()
    db.add(Inventory(product_id=seed_product.id, quantity=50, reorder_level=10))
    db.commit()

    token_owner = create_access_token(str(owner.id), biz.id, "OWNER")
    token_admin = create_access_token(str(admin.id), biz.id, "ADMIN")
    token_member = create_access_token(str(member.id), biz.id, "MEMBER")

    return {
        "biz": biz,
        "owner": owner,
        "admin": admin,
        "member": member,
        "seed_product": seed_product,
        "token_owner": token_owner,
        "token_admin": token_admin,
        "token_member": token_member,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/products
# ---------------------------------------------------------------------------

def _product_payload(biz_id: int, sku_suffix: str) -> dict:
    return {
        "business_id": biz_id,
        "name": f"Product {sku_suffix}",
        "category": "Test",
        "sku": f"M4S4-PROD-{sku_suffix}",
        "unit_price": 25.0,
        "initial_quantity": 10,
        "reorder_level": 2,
    }


def test_product_create_unauthenticated_returns_401(
    db_session: Session, unauth_client: TestClient
):
    """Unauthenticated request to POST /products must return 401."""
    ctx = _provision_tenant_with_roles(db_session)
    res = unauth_client.post(
        "/api/v1/products",
        json=_product_payload(ctx["biz"].id, "UNAUTH"),
    )
    assert res.status_code == 401, (
        f"Expected 401 Unauthorized for unauthenticated request, got {res.status_code}"
    )


def test_product_create_member_returns_403(
    db_session: Session, auth_client_factory
):
    """Authenticated MEMBER attempting POST /products must receive 403 Forbidden."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.post(
        "/api/v1/products",
        json=_product_payload(ctx["biz"].id, "MEMBERFAIL"),
    )
    assert res.status_code == 403, (
        f"Expected 403 Forbidden for MEMBER, got {res.status_code}"
    )
    assert "Operation requires one of the following roles" in res.json()["detail"]


def test_product_create_admin_returns_201(
    db_session: Session, auth_client_factory
):
    """Authenticated ADMIN must be allowed to POST /products (201 Created)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_admin = auth_client_factory(ctx["token_admin"])
    res = client_admin.post(
        "/api/v1/products",
        json=_product_payload(ctx["biz"].id, "ADMINOK"),
    )
    assert res.status_code == 201, (
        f"Expected 201 Created for ADMIN, got {res.status_code}: {res.text}"
    )
    assert res.json()["business_id"] == ctx["biz"].id


def test_product_create_owner_returns_201(
    db_session: Session, auth_client_factory
):
    """Authenticated OWNER must be allowed to POST /products (201 Created)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_owner = auth_client_factory(ctx["token_owner"])
    res = client_owner.post(
        "/api/v1/products",
        json=_product_payload(ctx["biz"].id, "OWNEROK"),
    )
    assert res.status_code == 201, (
        f"Expected 201 Created for OWNER, got {res.status_code}: {res.text}"
    )
    assert res.json()["business_id"] == ctx["biz"].id


def test_product_create_tenant_isolation_spoofed_business_id_ignored(
    db_session: Session, auth_client_factory
):
    """
    Tenant isolation: even if the OWNER supplies a spoofed business_id in the
    request body belonging to another tenant, the endpoint must bind the product
    to the authenticated tenant's business_id.
    """
    ctx_a = _provision_tenant_with_roles(db_session, "TenantA-M4S4Prod")
    ctx_b = _provision_tenant_with_roles(db_session, "TenantB-M4S4Prod")

    client_owner_a = auth_client_factory(ctx_a["token_owner"])
    payload = {
        "business_id": ctx_b["biz"].id,  # Spoofed tenant in payload
        "name": "Spoofed Tenant Product",
        "category": "Security",
        "sku": "M4S4-SPOOF-PROD-01",
        "unit_price": 99.0,
        "initial_quantity": 5,
        "reorder_level": 1,
    }
    res = client_owner_a.post("/api/v1/products", json=payload)
    assert res.status_code == 201
    created = res.json()
    # Must be bound to Tenant A, not Tenant B
    assert created["business_id"] == ctx_a["biz"].id, (
        "Tenant isolation failure: product created under the wrong tenant"
    )
    assert created["business_id"] != ctx_b["biz"].id


# ---------------------------------------------------------------------------
# POST /api/v1/transactions
# ---------------------------------------------------------------------------

def _tx_payload(biz_id: int, product_id: int) -> dict:
    return {
        "business_id": biz_id,
        "transaction_type": "sale",
        "items": [{"product_id": product_id, "quantity": 1, "unit_price": 10.0}],
    }


def test_transaction_create_unauthenticated_returns_401(
    db_session: Session, unauth_client: TestClient
):
    """Unauthenticated request to POST /transactions must return 401."""
    ctx = _provision_tenant_with_roles(db_session)
    res = unauth_client.post(
        "/api/v1/transactions",
        json=_tx_payload(ctx["biz"].id, ctx["seed_product"].id),
    )
    assert res.status_code == 401, (
        f"Expected 401 Unauthorized for unauthenticated request, got {res.status_code}"
    )


def test_transaction_create_member_returns_403(
    db_session: Session, auth_client_factory
):
    """Authenticated MEMBER attempting POST /transactions must receive 403 Forbidden."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.post(
        "/api/v1/transactions",
        json=_tx_payload(ctx["biz"].id, ctx["seed_product"].id),
    )
    assert res.status_code == 403, (
        f"Expected 403 Forbidden for MEMBER, got {res.status_code}"
    )
    assert "Operation requires one of the following roles" in res.json()["detail"]


def test_transaction_create_admin_returns_201(
    db_session: Session, auth_client_factory
):
    """Authenticated ADMIN must be allowed to POST /transactions (201 Created)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_admin = auth_client_factory(ctx["token_admin"])
    res = client_admin.post(
        "/api/v1/transactions",
        json=_tx_payload(ctx["biz"].id, ctx["seed_product"].id),
    )
    assert res.status_code == 201, (
        f"Expected 201 Created for ADMIN, got {res.status_code}: {res.text}"
    )
    assert res.json()["business_id"] == ctx["biz"].id


def test_transaction_create_owner_returns_201(
    db_session: Session, auth_client_factory
):
    """Authenticated OWNER must be allowed to POST /transactions (201 Created)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_owner = auth_client_factory(ctx["token_owner"])
    res = client_owner.post(
        "/api/v1/transactions",
        json=_tx_payload(ctx["biz"].id, ctx["seed_product"].id),
    )
    assert res.status_code == 201, (
        f"Expected 201 Created for OWNER, got {res.status_code}: {res.text}"
    )
    assert res.json()["business_id"] == ctx["biz"].id


def test_transaction_create_tenant_isolation_cross_tenant_product_rejected(
    db_session: Session, auth_client_factory
):
    """
    Tenant isolation: an authenticated OWNER from Tenant A must not be able to
    record a transaction referencing a product that belongs to Tenant B.
    The service-layer cross-tenant product check must reject this with 400.
    """
    ctx_a = _provision_tenant_with_roles(db_session, "TenantA-M4S4Tx")
    ctx_b = _provision_tenant_with_roles(db_session, "TenantB-M4S4Tx")

    client_owner_a = auth_client_factory(ctx_a["token_owner"])
    # Attempt to reference Tenant B's seed product in a Tenant A transaction
    payload = {
        "business_id": ctx_a["biz"].id,
        "transaction_type": "sale",
        "items": [
            {"product_id": ctx_b["seed_product"].id, "quantity": 1, "unit_price": 10.0}
        ],
    }
    res = client_owner_a.post("/api/v1/transactions", json=payload)
    assert res.status_code == 400, (
        f"Expected 400 for cross-tenant product reference, got {res.status_code}"
    )
    assert "Cross-business product mismatch" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Regression: PATCH /api/v1/inventory/{product_id}
# ---------------------------------------------------------------------------

def test_inventory_patch_owner_allowed_regression(db_session: Session, auth_client_factory):
    """Regression: OWNER must still be allowed to PATCH inventory (200 OK)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_owner = auth_client_factory(ctx["token_owner"])
    res = client_owner.patch(
        f"/api/v1/inventory/{ctx['seed_product'].id}",
        json={"quantity": 75},
    )
    assert res.status_code == 200
    assert res.json()["quantity"] == 75


def test_inventory_patch_admin_allowed_regression(db_session: Session, auth_client_factory):
    """Regression: ADMIN must still be allowed to PATCH inventory (200 OK)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_admin = auth_client_factory(ctx["token_admin"])
    res = client_admin.patch(
        f"/api/v1/inventory/{ctx['seed_product'].id}",
        json={"quantity": 60},
    )
    assert res.status_code == 200
    assert res.json()["quantity"] == 60


def test_inventory_patch_member_rejected_regression(db_session: Session, auth_client_factory):
    """Regression: MEMBER must still be rejected for PATCH inventory (403 Forbidden)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.patch(
        f"/api/v1/inventory/{ctx['seed_product'].id}",
        json={"quantity": 9999},
    )
    assert res.status_code == 403
    assert "Operation requires one of the following roles" in res.json()["detail"]


def test_inventory_patch_unauthenticated_returns_401_regression(
    db_session: Session, unauth_client: TestClient
):
    """Regression: unauthenticated PATCH inventory must return 401."""
    ctx = _provision_tenant_with_roles(db_session)
    res = unauth_client.patch(
        f"/api/v1/inventory/{ctx['seed_product'].id}",
        json={"quantity": 1},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# MEMBER Read Access Preserved
# ---------------------------------------------------------------------------

def test_member_can_read_products(db_session: Session, auth_client_factory):
    """MEMBER must still be able to GET /products (read access preserved)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.get("/api/v1/products")
    assert res.status_code == 200


def test_member_can_read_transactions(db_session: Session, auth_client_factory):
    """MEMBER must still be able to GET /transactions (read access preserved)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.get("/api/v1/transactions")
    assert res.status_code == 200


def test_member_can_read_inventory(db_session: Session, auth_client_factory):
    """MEMBER must still be able to GET /inventory (read access preserved)."""
    ctx = _provision_tenant_with_roles(db_session)
    client_member = auth_client_factory(ctx["token_member"])
    res = client_member.get("/api/v1/inventory")
    assert res.status_code == 200
