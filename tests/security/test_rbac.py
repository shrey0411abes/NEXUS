"""
Role-Based Access Control (RBAC) & DB-Authoritative Security Tests.
Phase 8: Milestone 1 Security Suite.

Verifies:
1. OWNER and ADMIN roles are permitted for administrative mutations (e.g. inventory adjustments).
2. MEMBER role is rejected with HTTP 403 Forbidden for administrative operations.
3. Database is the authoritative source of truth for user role and active status (stale JWT cannot bypass).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from models import Business, User, Product, Inventory


def _setup_tenant_with_roles(db: Session):
    """Create a single business with OWNER, ADMIN, and MEMBER users, plus one product."""
    biz = Business(name="RBAC Enterprise", industry="Retail")
    db.add(biz)
    db.flush()

    user_owner = User(
        business_id=biz.id,
        email="owner@rbac.test",
        password_hash=hash_password("Pass12345"),
        role="OWNER",
        is_active=True,
    )
    user_admin = User(
        business_id=biz.id,
        email="admin@rbac.test",
        password_hash=hash_password("Pass12345"),
        role="ADMIN",
        is_active=True,
    )
    user_member = User(
        business_id=biz.id,
        email="member@rbac.test",
        password_hash=hash_password("Pass12345"),
        role="MEMBER",
        is_active=True,
    )
    db.add_all([user_owner, user_admin, user_member])
    db.flush()

    prod = Product(
        business_id=biz.id,
        name="Inventory SKU",
        category="Hardware",
        sku="SKU-RBAC-01",
        unit_price=10.0,
    )
    db.add(prod)
    db.flush()
    db.add(Inventory(product_id=prod.id, quantity=100, reorder_level=20))
    db.commit()

    token_owner = create_access_token(str(user_owner.id), biz.id, "OWNER")
    token_admin = create_access_token(str(user_admin.id), biz.id, "ADMIN")
    token_member = create_access_token(str(user_member.id), biz.id, "MEMBER")

    return {
        "biz": biz,
        "owner": user_owner,
        "admin": user_admin,
        "member": user_member,
        "prod": prod,
        "token_owner": token_owner,
        "token_admin": token_admin,
        "token_member": token_member,
    }


def test_rbac_inventory_update_permissions(db_session: Session, auth_client_factory):
    """Verify that OWNER and ADMIN can update inventory, while MEMBER is rejected with 403 Forbidden."""
    ctx = _setup_tenant_with_roles(db_session)
    prod_id = ctx["prod"].id

    client_owner = auth_client_factory(ctx["token_owner"])
    client_admin = auth_client_factory(ctx["token_admin"])
    client_member = auth_client_factory(ctx["token_member"])

    # 1. OWNER PATCH inventory -> 200 Success
    res_owner = client_owner.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 120})
    assert res_owner.status_code == 200
    assert res_owner.json()["quantity"] == 120

    # 2. ADMIN PATCH inventory -> 200 Success
    res_admin = client_admin.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 140})
    assert res_admin.status_code == 200
    assert res_admin.json()["quantity"] == 140

    # 3. MEMBER PATCH inventory -> 403 Forbidden
    res_member = client_member.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 999})
    assert res_member.status_code == 403
    assert "Operation requires one of the following roles" in res_member.json()["detail"]


def test_jwt_stale_role_overridden_by_db_authority(db_session: Session, auth_client_factory):
    """
    CRITICAL SECURITY CHECK:
    Verify that if a user's JWT claims role='OWNER', but their DB record was demoted to 'MEMBER',
    the database remains authoritative and rejects the operation with 403 Forbidden.
    """
    ctx = _setup_tenant_with_roles(db_session)
    prod_id = ctx["prod"].id
    user_admin = ctx["admin"]

    # Issue a token where payload claims role='OWNER' (or ADMIN)
    stale_admin_token = ctx["token_admin"]

    # Demote user in database from ADMIN to MEMBER
    db_user = db_session.get(User, user_admin.id)
    db_user.role = "MEMBER"
    db_session.commit()

    # Attempt administrative action with previously issued token
    client = auth_client_factory(stale_admin_token)
    res = client.patch(f"/api/v1/inventory/{prod_id}", json={"quantity": 500})
    assert res.status_code == 403


def test_jwt_stale_active_status_overridden_by_db_authority(db_session: Session, auth_client_factory):
    """
    CRITICAL SECURITY CHECK:
    Verify that if a user is deactivated in the database, subsequent requests using
    an existing unexpired JWT are rejected with 401 Unauthorized.
    """
    ctx = _setup_tenant_with_roles(db_session)
    user_owner = ctx["owner"]
    token = ctx["token_owner"]

    client = auth_client_factory(token)

    # First request works
    assert client.get("/api/v1/businesses/me").status_code == 200

    # Deactivate user in database
    db_user = db_session.get(User, user_owner.id)
    db_user.is_active = False
    db_session.commit()

    # Subsequent request using same valid JWT must fail with 401
    res = client.get("/api/v1/businesses/me")
    assert res.status_code == 401
    assert "Inactive user account" in res.json()["detail"]
