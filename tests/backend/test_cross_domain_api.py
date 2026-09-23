"""Tests for Cross-Domain and Operational Prioritization REST API endpoints (auth-aware)."""
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models import Business, Product, Inventory, Transaction, TransactionItem


def test_cross_domain_api_endpoints(client: TestClient, db_session: Session):
    """Test /cross-domain/risks, /cross-domain/priorities, and /cross-domain/summary."""
    # Get the authenticated tenant's business
    me_res = client.get("/api/v1/businesses/me")
    assert me_res.status_code == 200
    biz_id = me_res.json()["id"]
    biz = db_session.get(Business, biz_id)

    # Seed product + inventory for the authenticated tenant
    prod = Product(business_id=biz.id, name="Test Product", category="Tech", sku="TP-001", unit_price=25.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=1, reorder_level=10))

    # Add transaction
    tx = Transaction(
        business_id=biz.id,
        transaction_type="sale",
        total_amount=25.0,
        transaction_date=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db_session.add(tx)
    db_session.flush()
    db_session.add(TransactionItem(transaction_id=tx.id, product_id=prod.id, quantity=1, unit_price=25.0))
    db_session.commit()

    # 1. Test GET /api/v1/cross-domain/risks
    res = client.get("/api/v1/cross-domain/risks?days=30")
    assert res.status_code == 200
    risks = res.json()
    assert isinstance(risks, list)
    assert len(risks) == 1
    assert risks[0]["correlation_type"] in ["ACCELERATING_DEPLETION", "STOCKOUT_IMMINENT", "SURGE_STOCKOUT_SQUEEZE"]
    assert "INVENTORY" in risks[0]["affected_domains"]

    # 2. Test GET /api/v1/cross-domain/priorities
    res_p = client.get("/api/v1/cross-domain/priorities?days=30")
    assert res_p.status_code == 200
    priorities = res_p.json()
    assert isinstance(priorities, list)
    assert len(priorities) == 1
    assert priorities[0]["priority_rank"] == 1
    assert priorities[0]["priority_score"] > 0
    assert priorities[0]["source_status"] == "VERIFIED_FACT"

    # 3. Test GET /api/v1/cross-domain/summary
    res_s = client.get("/api/v1/cross-domain/summary?days=30")
    assert res_s.status_code == 200
    summary = res_s.json()
    assert summary["business_id"] == biz_id
    assert summary["correlations_count"] == 1
    assert len(summary["prioritized_queue"]) == 1

    # 4. Test 401 on unauthenticated request
    from fastapi.testclient import TestClient as TC
    from app.main import app
    from database import get_db
    def _override():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = _override
    anon_client = TC(app)
    res_401 = anon_client.get("/api/v1/cross-domain/risks?days=30")
    assert res_401.status_code == 401

    # 5. Test 422 on invalid parameters (e.g. days=0 or days=500)
    res_invalid = client.get("/api/v1/cross-domain/risks?days=0")
    assert res_invalid.status_code == 422


def test_record_risk_action_owner_success(client: TestClient, db_session: Session):
    """OWNER role can record a risk action transition (201 Created) with audit metadata."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]

    prod = Product(business_id=biz_id, name="Risk Item", category="Hardware", sku="RSK-01", unit_price=10.0)
    db_session.add(prod)
    db_session.commit()

    payload = {
        "risk_fingerprint": "fp_test_action_01",
        "product_id": prod.id,
        "risk_category": "SURGE_STOCKOUT_SQUEEZE",
        "state": "ACKNOWLEDGED",
        "action_note": "Supplier notified; expediting freight.",
        "metrics_snapshot": {"current_quantity": 2, "doi": 1.2},
    }

    res = client.post("/api/v1/cross-domain/actions", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] is not None
    assert data["business_id"] == biz_id
    assert data["state"] == "ACKNOWLEDGED"
    assert data["risk_fingerprint"] == "fp_test_action_01"
    assert data["action_note"] == "Supplier notified; expediting freight."
    assert data["metrics_snapshot"]["current_quantity"] == 2
    assert "created_at" in data


def test_record_risk_action_member_role_forbidden(
    db_session: Session,
    auth_client_factory,
):
    """MEMBER role is rejected with 403 Forbidden when attempting to record risk action."""
    from app.core.security import create_access_token, hash_password
    from models.user import User

    biz = Business(name="RBAC Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    member = User(
        business_id=biz.id,
        email="member@rbac.test",
        password_hash=hash_password("SecurePass123"),
        role="MEMBER",
        is_active=True,
    )
    db_session.add(member)
    db_session.commit()

    token = create_access_token(str(member.id), biz.id, role="MEMBER")
    member_client = auth_client_factory(token)

    payload = {
        "risk_fingerprint": "fp_member_attempt",
        "risk_category": "STOCKOUT_IMMINENT",
        "state": "RESOLVED",
    }
    res = member_client.post("/api/v1/cross-domain/actions", json=payload)
    assert res.status_code == 403
    assert "Operation requires one of the following roles" in res.json()["detail"]


def test_record_risk_action_cross_tenant_product_not_found(
    client: TestClient,
    db_session: Session,
):
    """Referencing a product belonging to another tenant returns 404 (IDOR prevention)."""
    other_biz = Business(name="Foreign Tenant", industry="Tech")
    db_session.add(other_biz)
    db_session.flush()

    foreign_prod = Product(business_id=other_biz.id, name="Foreign SKU", category="Tech", sku="FOR-01", unit_price=99.0)
    db_session.add(foreign_prod)
    db_session.commit()

    payload = {
        "risk_fingerprint": "fp_idor_test",
        "product_id": foreign_prod.id,
        "risk_category": "DEAD_STOCK_CAPITAL_TRAP",
        "state": "DISMISSED",
    }
    res = client.post("/api/v1/cross-domain/actions", json=payload)
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_risk_actions_history_and_member_access(
    db_session: Session,
    auth_client_factory,
):
    """GET /cross-domain/actions lists history, supports filtering, and is open to MEMBER role."""
    from app.core.security import create_access_token, hash_password
    from models.user import User

    biz = Business(name="History Biz", industry="Retail")
    db_session.add(biz)
    db_session.flush()

    admin = User(business_id=biz.id, email="admin@hist.test", password_hash=hash_password("SecurePass123"), role="ADMIN")
    member = User(business_id=biz.id, email="member@hist.test", password_hash=hash_password("SecurePass123"), role="MEMBER")
    db_session.add_all([admin, member])
    db_session.commit()

    admin_token = create_access_token(str(admin.id), biz.id, role="ADMIN")
    member_token = create_access_token(str(member.id), biz.id, role="MEMBER")

    admin_client = auth_client_factory(admin_token)
    member_client = auth_client_factory(member_token)

    # 1. Admin records multiple actions
    admin_client.post("/api/v1/cross-domain/actions", json={
        "risk_fingerprint": "fp_1",
        "risk_category": "SURGE_STOCKOUT_SQUEEZE",
        "state": "ACKNOWLEDGED",
    })
    admin_client.post("/api/v1/cross-domain/actions", json={
        "risk_fingerprint": "fp_2",
        "risk_category": "STOCKOUT_IMMINENT",
        "state": "RESOLVED",
    })

    # 2. Member reads history (200 OK)
    res = member_client.get("/api/v1/cross-domain/actions")
    assert res.status_code == 200
    actions = res.json()
    assert len(actions) == 2

    # 3. Filter by state=RESOLVED
    res_filtered = member_client.get("/api/v1/cross-domain/actions?state=RESOLVED")
    assert res_filtered.status_code == 200
    filtered = res_filtered.json()
    assert len(filtered) == 1
    assert filtered[0]["state"] == "RESOLVED"
    assert filtered[0]["risk_fingerprint"] == "fp_2"


def test_priorities_endpoint_include_resolved_param(client: TestClient, db_session: Session):
    """GET /cross-domain/priorities respects include_resolved parameter."""
    me_res = client.get("/api/v1/businesses/me")
    biz_id = me_res.json()["id"]

    prod = Product(business_id=biz_id, name="Resolving SKU", category="Tech", sku="RES-01", unit_price=30.0)
    db_session.add(prod)
    db_session.flush()
    db_session.add(Inventory(product_id=prod.id, quantity=0, reorder_level=10))
    db_session.commit()

    # Query priorities initially -> detected as STOCKOUT_IMMINENT
    res1 = client.get("/api/v1/cross-domain/priorities?days=30")
    assert res1.status_code == 200
    p_list = res1.json()
    assert len(p_list) >= 1
    target_fp = p_list[0]["risk_fingerprint"]

    # Record action: RESOLVED
    res_act = client.post("/api/v1/cross-domain/actions", json={
        "risk_fingerprint": target_fp,
        "product_id": prod.id,
        "risk_category": "STOCKOUT_IMMINENT",
        "state": "RESOLVED",
        "action_note": "Reorder placed",
    })
    assert res_act.status_code == 201

    # Default include_resolved=False: risk is suppressed
    res_active = client.get("/api/v1/cross-domain/priorities?days=30&include_resolved=false")
    assert all(p["risk_fingerprint"] != target_fp for p in res_active.json())

    # include_resolved=True: risk is returned with state RESOLVED
    res_all = client.get("/api/v1/cross-domain/priorities?days=30&include_resolved=true")
    all_items = res_all.json()
    resolved_item = next((p for p in all_items if p["risk_fingerprint"] == target_fp), None)
    assert resolved_item is not None
    assert resolved_item["current_state"] == "RESOLVED"
    assert resolved_item["last_action_note"] == "Reorder placed"


def test_cross_domain_actions_tenant_isolation(
    db_session: Session,
    auth_client_factory,
):
    """Tenant A's risk actions are completely invisible to Tenant B."""
    from app.core.security import create_access_token, hash_password
    from models.user import User

    biz_a = Business(name="Tenant A", industry="A")
    biz_b = Business(name="Tenant B", industry="B")
    db_session.add_all([biz_a, biz_b])
    db_session.flush()

    user_a = User(business_id=biz_a.id, email="a@tenant.test", password_hash=hash_password("SecurePass123"), role="ADMIN")
    user_b = User(business_id=biz_b.id, email="b@tenant.test", password_hash=hash_password("SecurePass123"), role="ADMIN")
    db_session.add_all([user_a, user_b])
    db_session.commit()

    client_a = auth_client_factory(create_access_token(str(user_a.id), biz_a.id, role="ADMIN"))
    client_b = auth_client_factory(create_access_token(str(user_b.id), biz_b.id, role="ADMIN"))

    # Tenant A records an action
    client_a.post("/api/v1/cross-domain/actions", json={
        "risk_fingerprint": "fp_secret_tenant_a",
        "risk_category": "SURGE_STOCKOUT_SQUEEZE",
        "state": "ACKNOWLEDGED",
    })

    # Tenant B lists actions -> must be empty
    res_b = client_b.get("/api/v1/cross-domain/actions")
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0

