"""
Tests for Authoritative Transaction Total Integrity and Decimal Validation.
Phase 3A.1: Data Integrity + Product Foundation.

Verifies:
1. total_amount omitted -> server calculates exact Decimal total.
2. matching client total -> transaction succeeds with 201.
3. mismatching client total -> rejected with HTTP 422.
4. Decimal fractional boundaries (ROUND_HALF_UP).
5. Zero-value valid transaction semantics.
6. Client cannot spoof or override authoritative server calculation.
7. Tenant isolation preserved.
8. Cross-tenant product rejection (HTTP 400).
"""
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from models import Business, User, Product, Inventory, Transaction


def _provision_tenant(db: Session, biz_name: str, email: str, role: str = "OWNER") -> tuple[Business, User, str]:
    """Helper to provision a business, user, and JWT token."""
    biz = Business(name=biz_name, industry="Retail")
    db.add(biz)
    db.flush()

    user = User(
        business_id=biz.id,
        email=email.lower(),
        password_hash=hash_password("Pass123!Safe"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(biz)
    db.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        business_id=biz.id,
        role=user.role,
    )
    return biz, user, token


def _create_product(db: Session, business_id: int, sku: str, price: Decimal, name: str = "Item") -> Product:
    """Helper to create a product and initial inventory."""
    prod = Product(
        business_id=business_id,
        name=f"{name} {sku}",
        category="General",
        sku=sku,
        unit_price=price,
    )
    db.add(prod)
    db.flush()
    inv = Inventory(product_id=prod.id, quantity=100, reorder_level=10)
    db.add(inv)
    db.commit()
    db.refresh(prod)
    return prod


def test_transaction_total_omitted_calculates_server_total(
    db_session: Session,
    auth_client_factory,
):
    """When total_amount is omitted, the server calculates exact total from line items."""
    biz, user, token = _provision_tenant(db_session, "Store Omit", "omit@test.com")
    p1 = _create_product(db_session, biz.id, "SKU-OMIT-1", Decimal("19.99"))
    p2 = _create_product(db_session, biz.id, "SKU-OMIT-2", Decimal("0.33"))

    client = auth_client_factory(token)
    payload = {
        "business_id": biz.id,
        "transaction_type": "sale",
        # total_amount omitted intentionally
        "items": [
            {"product_id": p1.id, "quantity": 3, "unit_price": 19.99},  # 59.97
            {"product_id": p2.id, "quantity": 7, "unit_price": 0.33},   # 2.31
        ]
    }
    resp = client.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    # 59.97 + 2.31 = 62.28
    assert Decimal(str(data["total_amount"])) == Decimal("62.28")
    assert len(data["items"]) == 2


def test_transaction_total_matching_succeeds(
    db_session: Session,
    auth_client_factory,
):
    """When supplied total_amount matches authoritative calculation, request succeeds."""
    biz, user, token = _provision_tenant(db_session, "Store Match", "match@test.com")
    p1 = _create_product(db_session, biz.id, "SKU-MATCH-1", Decimal("25.50"))

    client = auth_client_factory(token)
    payload = {
        "business_id": biz.id,
        "transaction_type": "sale",
        "total_amount": 51.00,  # 2 * 25.50 = 51.00 exactly
        "items": [
            {"product_id": p1.id, "quantity": 2, "unit_price": 25.50},
        ]
    }
    resp = client.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert Decimal(str(data["total_amount"])) == Decimal("51.00")


def test_transaction_total_mismatch_returns_422(
    db_session: Session,
    auth_client_factory,
):
    """When supplied total_amount differs from calculated item total, return HTTP 422."""
    biz, user, token = _provision_tenant(db_session, "Store Mismatch", "mismatch@test.com")
    p1 = _create_product(db_session, biz.id, "SKU-MISMATCH-1", Decimal("25.00"))

    client = auth_client_factory(token)
    # Calculated is 2 * 25.00 = 50.00, client claims 45.00
    payload = {
        "business_id": biz.id,
        "transaction_type": "sale",
        "total_amount": 45.00,
        "items": [
            {"product_id": p1.id, "quantity": 2, "unit_price": 25.00},
        ]
    }
    resp = client.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 422
    assert "Transaction total mismatch" in resp.json()["detail"]


def test_transaction_total_decimal_fractional_boundaries(
    db_session: Session,
    auth_client_factory,
):
    """Exact Decimal calculations avoid IEEE 754 floating point imprecision."""
    biz, user, token = _provision_tenant(db_session, "Store Dec", "dec@test.com")
    p1 = _create_product(db_session, biz.id, "SKU-DEC-1", Decimal("19.99"))
    p2 = _create_product(db_session, biz.id, "SKU-DEC-2", Decimal("0.33"))
    p3 = _create_product(db_session, biz.id, "SKU-DEC-3", Decimal("14.50"))

    client = auth_client_factory(token)
    # (3 * 19.99) + (7 * 0.33) + (2 * 14.50) = 59.97 + 2.31 + 29.00 = 91.28
    payload = {
        "business_id": biz.id,
        "transaction_type": "sale",
        "total_amount": 91.28,
        "items": [
            {"product_id": p1.id, "quantity": 3, "unit_price": 19.99},
            {"product_id": p2.id, "quantity": 7, "unit_price": 0.33},
            {"product_id": p3.id, "quantity": 2, "unit_price": 14.50},
        ]
    }
    resp = client.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 201
    assert Decimal(str(resp.json()["total_amount"])) == Decimal("91.28")


def test_transaction_zero_value_valid_semantics(
    db_session: Session,
    auth_client_factory,
):
    """Zero-value items are valid according to DB CheckConstraints (unit_price >= 0, total >= 0)."""
    biz, user, token = _provision_tenant(db_session, "Store Zero", "zero@test.com")
    p_promo = _create_product(db_session, biz.id, "SKU-PROMO", Decimal("0.00"), name="Free Sample")

    client = auth_client_factory(token)
    payload = {
        "business_id": biz.id,
        "transaction_type": "sale",
        "total_amount": 0.00,
        "items": [
            {"product_id": p_promo.id, "quantity": 1, "unit_price": 0.00},
        ]
    }
    resp = client.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 201
    assert Decimal(str(resp.json()["total_amount"])) == Decimal("0.00")


def test_transaction_tenant_isolation_spoofed_id_ignored(
    db_session: Session,
    auth_client_factory,
):
    """Client-supplied business_id is overridden by authenticated tenant context."""
    biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant A", "owner.a@test.com")
    biz_b, _, _ = _provision_tenant(db_session, "Tenant B", "owner.b@test.com")
    prod_a = _create_product(db_session, biz_a.id, "SKU-A-1", Decimal("10.00"))

    client_a = auth_client_factory(token_a)
    payload = {
        "business_id": biz_b.id,  # Spoofing Tenant B
        "transaction_type": "sale",
        "items": [
            {"product_id": prod_a.id, "quantity": 1, "unit_price": 10.00},
        ]
    }
    resp = client_a.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["business_id"] == biz_a.id
    assert data["business_id"] != biz_b.id


def test_transaction_cross_tenant_product_rejected(
    db_session: Session,
    auth_client_factory,
):
    """Attempting to sell a product belonging to another tenant returns 400 Bad Request."""
    biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant A", "owner.a2@test.com")
    biz_b, _, _ = _provision_tenant(db_session, "Tenant B", "owner.b2@test.com")
    prod_b = _create_product(db_session, biz_b.id, "SKU-B-1", Decimal("50.00"))

    client_a = auth_client_factory(token_a)
    payload = {
        "business_id": biz_a.id,
        "transaction_type": "sale",
        "items": [
            {"product_id": prod_b.id, "quantity": 1, "unit_price": 50.00},
        ]
    }
    resp = client_a.post("/api/v1/transactions", json=payload)
    assert resp.status_code == 400
    assert "Cross-business product mismatch" in resp.json()["detail"]
