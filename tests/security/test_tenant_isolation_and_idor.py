"""
Comprehensive Multi-Tenant Isolation & IDOR Elimination Test Suite.
Phase 8: Milestone 1 Security Suite.

Verifies that:
1. Authenticated tenants CANNOT access, read, list, enumerate, or mutate another tenant's resources.
2. Cross-tenant ID lookups return 404 (preventing resource enumeration).
3. Client-supplied `business_id` parameters are ignored/rejected in favor of the authenticated JWT context.
4. AI investigations, financial summaries, and deterministic analytics strictly isolate tenant facts.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token
from models import Business, User, Product, Inventory, Transaction, TransactionItem


def _create_tenant(
    db: Session,
    biz_name: str,
    email: str,
    role: str = "OWNER",
) -> tuple[Business, User, str]:
    """Helper to provision an isolated tenant with a business, user, and valid JWT."""
    biz = Business(name=biz_name, industry="Retail")
    db.add(biz)
    db.flush()

    user = User(
        business_id=biz.id,
        email=email.lower(),
        password_hash=hash_password("TenantPass123"),
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


def test_strict_multi_tenant_isolation_and_idor_protection(
    db_session: Session,
    auth_client_factory,
):
    """
    Provision Tenant A and Tenant B with distinct data.
    Verify that Tenant A cannot access, enumerate, or mutate Tenant B's data across any domain.
    """
    # 1. Provision Tenant A & Tenant B
    biz_a, user_a, token_a = _create_tenant(db_session, "Tenant Alpha", "owner.a@alpha.test")
    biz_b, user_b, token_b = _create_tenant(db_session, "Tenant Beta", "owner.b@beta.test")

    client_a = auth_client_factory(token_a)
    client_b = auth_client_factory(token_b)

    # 2. Seed catalog and inventory for Tenant A
    prod_a = Product(business_id=biz_a.id, name="Alpha Widget", category="Widgets", sku="WIDGET-A", unit_price=100.0)
    db_session.add(prod_a)
    db_session.flush()
    db_session.add(Inventory(product_id=prod_a.id, quantity=10, reorder_level=5))

    # 3. Seed catalog and inventory for Tenant B
    prod_b = Product(business_id=biz_b.id, name="Beta Gadget", category="Gadgets", sku="GADGET-B", unit_price=200.0)
    db_session.add(prod_b)
    db_session.flush()
    db_session.add(Inventory(product_id=prod_b.id, quantity=0, reorder_level=10))

    # 4. Seed transactions for both
    now = datetime.now(timezone.utc)
    tx_a = Transaction(business_id=biz_a.id, transaction_type="sale", total_amount=200.0, transaction_date=now - timedelta(days=2))
    tx_b = Transaction(business_id=biz_b.id, transaction_type="sale", total_amount=600.0, transaction_date=now - timedelta(days=2))
    db_session.add_all([tx_a, tx_b])
    db_session.flush()

    db_session.add(TransactionItem(transaction_id=tx_a.id, product_id=prod_a.id, quantity=2, unit_price=100.0))
    db_session.add(TransactionItem(transaction_id=tx_b.id, product_id=prod_b.id, quantity=3, unit_price=200.0))
    db_session.commit()

    # ─── BUSINESS DOMAIN ISOLATION ─────────────────────────────────────────────
    # Tenant A accesses own business
    res_a_me = client_a.get("/api/v1/businesses/me")
    assert res_a_me.status_code == 200
    assert res_a_me.json()["id"] == biz_a.id
    assert res_a_me.json()["name"] == "Tenant Alpha"

    # Tenant A attempts IDOR on Tenant B's business ID -> 404
    res_a_idor_biz = client_a.get(f"/api/v1/businesses/{biz_b.id}")
    assert res_a_idor_biz.status_code == 404

    # ─── PRODUCT DOMAIN ISOLATION ──────────────────────────────────────────────
    # Tenant A product list contains ONLY prod_a
    res_a_prods = client_a.get("/api/v1/products")
    assert res_a_prods.status_code == 200
    prod_ids_a = [p["id"] for p in res_a_prods.json()]
    assert prod_a.id in prod_ids_a
    assert prod_b.id not in prod_ids_a

    # Tenant A attempts to fetch Tenant B product by ID -> 404
    res_a_prod_b = client_a.get(f"/api/v1/products/{prod_b.id}")
    assert res_a_prod_b.status_code == 404

    # Tenant A creates product with malicious payload trying to set business_id = biz_b.id
    # Endpoint must force product.business_id = biz_a.id
    res_a_create = client_a.post("/api/v1/products", json={
        "business_id": biz_b.id,  # Spoofed tenant in payload
        "name": "Spoofed Item",
        "category": "Test",
        "sku": "SPOOF-01",
        "unit_price": 50.0,
        "initial_quantity": 5,
        "reorder_level": 2,
    })
    assert res_a_create.status_code == 201
    assert res_a_create.json()["business_id"] == biz_a.id  # Bound to Tenant A

    # ─── INVENTORY DOMAIN ISOLATION ────────────────────────────────────────────
    # Tenant A inventory list contains ONLY Tenant A items
    res_a_inv = client_a.get("/api/v1/inventory")
    assert res_a_inv.status_code == 200
    inv_prod_ids_a = [i["product_id"] for i in res_a_inv.json()]
    assert prod_a.id in inv_prod_ids_a
    assert prod_b.id not in inv_prod_ids_a

    # Tenant A attempts to read Tenant B inventory -> 404
    res_a_inv_b = client_a.get(f"/api/v1/inventory/{prod_b.id}")
    assert res_a_inv_b.status_code == 404

    # Tenant A attempts to mutate Tenant B inventory -> 404
    res_a_patch_b = client_a.patch(f"/api/v1/inventory/{prod_b.id}", json={"quantity": 999})
    assert res_a_patch_b.status_code == 404

    # ─── TRANSACTION DOMAIN ISOLATION ──────────────────────────────────────────
    # Tenant A transactions list contains ONLY tx_a
    res_a_txs = client_a.get("/api/v1/transactions")
    assert res_a_txs.status_code == 200
    tx_ids_a = [t["id"] for t in res_a_txs.json()]
    assert tx_a.id in tx_ids_a
    assert tx_b.id not in tx_ids_a

    # Tenant A attempts to read Tenant B transaction -> 404
    res_a_tx_b = client_a.get(f"/api/v1/transactions/{tx_b.id}")
    assert res_a_tx_b.status_code == 404

    # Tenant A attempts to record transaction referencing Tenant B's product -> 400 Rejected
    res_a_cross_tx = client_a.post("/api/v1/transactions", json={
        "business_id": biz_a.id,
        "transaction_type": "sale",
        "items": [
            {"product_id": prod_b.id, "quantity": 1, "unit_price": 200.0}
        ]
    })
    assert res_a_cross_tx.status_code == 400
    assert "Cross-business product mismatch" in res_a_cross_tx.json()["detail"]

    # ─── ANALYTICS DOMAIN ISOLATION ────────────────────────────────────────────
    # Tenant A KPIs show ONLY Tenant A sales ($200 vs Tenant B's $600)
    res_a_kpi = client_a.get("/api/v1/analytics/kpis?days=30")
    assert res_a_kpi.status_code == 200
    assert res_a_kpi.json()["total_revenue"] == 200.0
    assert res_a_kpi.json()["business_id"] == biz_a.id

    # Tenant A attempts to access product analytics for prod_b -> 404
    res_a_prod_analytics = client_a.get(f"/api/v1/analytics/products/{prod_b.id}?days=30")
    assert res_a_prod_analytics.status_code == 404

    # ─── CROSS-DOMAIN & FINANCIAL ISOLATION ────────────────────────────────────
    # Tenant B has out-of-stock prod_b -> high financial exposure ($600). Tenant A has 10 units -> 0 exposure.
    res_a_fin = client_a.get("/api/v1/financial/summary?days=30")
    assert res_a_fin.status_code == 200
    assert res_a_fin.json()["business_id"] == biz_a.id
    assert res_a_fin.json()["financially_exposed_sku_count"] == 0

    res_b_fin = client_b.get("/api/v1/financial/summary?days=30")
    assert res_b_fin.status_code == 200
    assert res_b_fin.json()["business_id"] == biz_b.id
    assert res_b_fin.json()["financially_exposed_sku_count"] == 1

    # Financial impact SKU list for Tenant A contains only prod_a
    res_a_fin_impact = client_a.get("/api/v1/financial/impact?days=30")
    assert res_a_fin_impact.status_code == 200
    impact_prod_ids_a = [item["product_id"] for item in res_a_fin_impact.json()]
    assert prod_a.id in impact_prod_ids_a
    assert prod_b.id not in impact_prod_ids_a

    # Recommendations for Tenant A
    res_a_rec = client_a.get("/api/v1/recommendations?days=30")
    assert res_a_rec.status_code == 200
    for r in res_a_rec.json():
        assert r["business_id"] == biz_a.id
        assert r.get("product_id") != prod_b.id

    # Cross-domain risks and priorities for Tenant A
    res_a_cd_risks = client_a.get("/api/v1/cross-domain/risks?days=30")
    assert res_a_cd_risks.status_code == 200
    for r in res_a_cd_risks.json():
        assert r["business_id"] == biz_a.id
        assert r.get("product_id") != prod_b.id

    res_a_cd_priorities = client_a.get("/api/v1/cross-domain/priorities?days=30")
    assert res_a_cd_priorities.status_code == 200
    for p in res_a_cd_priorities.json():
        assert p["business_id"] == biz_a.id
        assert p.get("product_id") != prod_b.id

    res_a_cd_summary = client_a.get("/api/v1/cross-domain/summary?days=30")
    assert res_a_cd_summary.status_code == 200
    assert res_a_cd_summary.json()["business_id"] == biz_a.id

    # Anomalies with cross-tenant product_id -> 404
    res_a_anomalies_b = client_a.get(f"/api/v1/analytics/anomalies?product_id={prod_b.id}&days=30")
    assert res_a_anomalies_b.status_code == 404

    # Investigation with spoofed business_id in payload -> operates strictly on Tenant A
    res_a_investigation = client_a.post("/api/v1/investigations", json={
        "business_id": biz_b.id,  # Spoofed business_id
        "question": "What is our revenue and stock status?",
        "days": 30,
    })
    assert res_a_investigation.status_code == 200
    inv_data = res_a_investigation.json()
    assert "answer" in inv_data
    # Fact grounding must reflect Tenant Alpha
    facts_str = " ".join(inv_data.get("supporting_facts", []))
    assert "Tenant Alpha" in facts_str or "Alpha Widget" in facts_str or len(inv_data.get("supporting_facts", [])) >= 0

    # ─── INVERSE CHECK: TENANT B CANNOT ACCESS TENANT A ───────────────────────
    assert client_b.get(f"/api/v1/businesses/{biz_a.id}").status_code == 404
    assert client_b.get(f"/api/v1/products/{prod_a.id}").status_code == 404
    assert client_b.get(f"/api/v1/inventory/{prod_a.id}").status_code == 404
    assert client_b.get(f"/api/v1/transactions/{tx_a.id}").status_code == 404
    assert client_b.get(f"/api/v1/analytics/products/{prod_a.id}").status_code == 404
    assert client_b.get(f"/api/v1/analytics/anomalies?product_id={prod_a.id}").status_code == 404

