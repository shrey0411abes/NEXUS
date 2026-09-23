"""
Milestone 3-S5 Slice 2: Tenant-Scoped Read-Only Investigation History API Tests.

Verifies:
1. API Functionality:
   - Authenticated list (GET /api/v1/investigations)
   - Authenticated detail (GET /api/v1/investigations/{id})
   - Empty history returns []
   - Newest-first reverse-chronological ordering (created_at DESC, id DESC)
   - Deterministic timestamp tie-breaking (identical timestamps ordered by id DESC)
   - Pagination slicing (limit and offset)
   - Detail response format (answer, context_snapshot, verification_status, etc.)
   - Nonexistent investigation ID returns 404

2. Security & Tenant Isolation:
   - Unauthenticated list returns 401
   - Unauthenticated detail returns 401
   - Tenant A only sees Tenant A records
   - Tenant B only sees Tenant B records
   - Cross-tenant detail access returns 404 (IDOR protection)
   - No cross-tenant metadata leakage in 404 response
   - Client business_id query override attempt ignored
   - Pagination parameters never leak cross-tenant records

3. Validation:
   - limit=1 returns 200
   - limit=100 returns 200
   - limit=0 returns 422
   - limit=101 returns 422
   - limit=-1 returns 422
   - limit=abc returns 422
   - offset=-1 returns 422
   - large valid offset returns 200 with []

4. Persistence Compatibility & Data Minimization:
   - Data minimization: business_id and raw user_id omitted from schemas
   - user_id=NULL investigation remains fully readable
   - No User join required for history retrieval
"""
from datetime import datetime, timezone, timedelta
from typing import Tuple
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.business import Business
from models.user import User
from models.investigation import Investigation
from app.core.security import hash_password, create_access_token


def _provision_tenant(
    db: Session,
    biz_name: str,
    email: str,
) -> Tuple[Business, User, str]:
    """Helper to provision an isolated tenant with a business, user, and valid JWT."""
    biz = Business(name=biz_name, industry="Retail")
    db.add(biz)
    db.flush()

    user = User(
        business_id=biz.id,
        email=email.lower(),
        password_hash=hash_password("TenantPass123"),
        role="OWNER",
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


def _seed_investigation(
    db: Session,
    business_id: int,
    user_id: int | None = None,
    question: str = "What is our revenue?",
    answer: str = "Total revenue was $50,000.",
    confidence: str = "HIGH",
    verification_status: str = "VERIFIED",
    provider: str = "mock",
    duration_ms: float = 45.0,
    created_at: datetime | None = None,
) -> Investigation:
    """Helper to seed an investigation audit record directly into the test DB."""
    inv = Investigation(
        business_id=business_id,
        user_id=user_id,
        question=question,
        answer=answer,
        confidence=confidence,
        verification_status=verification_status,
        context_snapshot={
            "facts": {"total_revenue": 50000.0},
            "verdicts": [
                {
                    "raw_text": "Total revenue was $50,000.",
                    "extracted_value": 50000.0,
                    "matched_fact": "total_revenue",
                    "status": "VERIFIED",
                    "reason": "Matches deterministic fact",
                }
            ],
            "limitations": [],
            "days": 30,
        },
        provider=provider,
        execution_duration_ms=duration_ms,
    )
    if created_at is not None:
        inv.created_at = created_at
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


# ---------------------------------------------------------------------------
# 1. Functionality Tests
# ---------------------------------------------------------------------------

class TestInvestigationHistoryFunctionality:
    """Tests for core read-only history listing and detail retrieval."""

    def test_list_investigations_empty_history(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify an authenticated tenant with no investigations receives an empty list."""
        _, _, token = _provision_tenant(db_session, "Empty Biz", "empty@nexus.test")
        client = auth_client_factory(token)

        res = client.get("/api/v1/investigations")
        assert res.status_code == 200
        assert res.json() == []

    def test_list_investigations_authenticated_success(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify authenticated list returns populated summary records."""
        biz, user, token = _provision_tenant(db_session, "List Biz", "list@nexus.test")
        client = auth_client_factory(token)

        inv = _seed_investigation(
            db_session,
            business_id=biz.id,
            user_id=user.id,
            question="What is our 30-day revenue?",
            answer="Revenue was $10,000.",
            confidence="HIGH",
            verification_status="VERIFIED",
        )

        res = client.get("/api/v1/investigations")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1

        item = data[0]
        assert item["id"] == inv.id
        assert item["question"] == "What is our 30-day revenue?"
        assert item["confidence"] == "HIGH"
        assert item["verification_status"] == "VERIFIED"
        assert item["provider"] == "mock"
        assert "execution_duration_ms" in item
        assert "created_at" in item
        # Detail fields must NOT be in summary
        assert "answer" not in item
        assert "context_snapshot" not in item
        # Data minimization: internal identifiers omitted
        assert "business_id" not in item
        assert "user_id" not in item

    def test_get_investigation_detail_authenticated_success(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify detail endpoint returns full record including answer and context snapshot."""
        biz, user, token = _provision_tenant(db_session, "Detail Biz", "detail@nexus.test")
        client = auth_client_factory(token)

        inv = _seed_investigation(
            db_session,
            business_id=biz.id,
            user_id=user.id,
            question="What are top risks?",
            answer="Stockout risk detected for SKU-1.",
            confidence="MEDIUM",
            verification_status="PARTIALLY_VERIFIED",
        )

        res = client.get(f"/api/v1/investigations/{inv.id}")
        assert res.status_code == 200
        data = res.json()

        assert data["id"] == inv.id
        assert data["question"] == "What are top risks?"
        assert data["answer"] == "Stockout risk detected for SKU-1."
        assert data["confidence"] == "MEDIUM"
        assert data["verification_status"] == "PARTIALLY_VERIFIED"
        assert data["provider"] == "mock"
        assert isinstance(data["context_snapshot"], dict)
        assert "facts" in data["context_snapshot"]
        assert "verdicts" in data["context_snapshot"]
        assert "limitations" in data["context_snapshot"]
        assert "days" in data["context_snapshot"]
        # Data minimization
        assert "business_id" not in data
        assert "user_id" not in data

    def test_get_investigation_not_found(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify accessing a non-existent investigation ID returns 404."""
        _, _, token = _provision_tenant(db_session, "Missing Biz", "missing@nexus.test")
        client = auth_client_factory(token)

        res = client.get("/api/v1/investigations/99999")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

    def test_investigations_newest_first_ordering(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify investigations are returned in reverse chronological order (newest first)."""
        biz, user, token = _provision_tenant(db_session, "Order Biz", "order@nexus.test")
        client = auth_client_factory(token)

        now = datetime.now(timezone.utc)
        inv1 = _seed_investigation(db_session, biz.id, user.id, question="Q1 Oldest", created_at=now - timedelta(hours=3))
        inv2 = _seed_investigation(db_session, biz.id, user.id, question="Q2 Middle", created_at=now - timedelta(hours=2))
        inv3 = _seed_investigation(db_session, biz.id, user.id, question="Q3 Newest", created_at=now - timedelta(hours=1))

        res = client.get("/api/v1/investigations")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        assert [item["id"] for item in data] == [inv3.id, inv2.id, inv1.id]

    def test_deterministic_timestamp_tie_breaking(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify that identical timestamps are deterministically ordered by id DESC."""
        biz, user, token = _provision_tenant(db_session, "Tie Biz", "tie@nexus.test")
        client = auth_client_factory(token)

        fixed_time = datetime(2026, 9, 1, 12, 0, 0, tzinfo=timezone.utc)
        inv1 = _seed_investigation(db_session, biz.id, user.id, question="Tie 1", created_at=fixed_time)
        inv2 = _seed_investigation(db_session, biz.id, user.id, question="Tie 2", created_at=fixed_time)
        inv3 = _seed_investigation(db_session, biz.id, user.id, question="Tie 3", created_at=fixed_time)

        res = client.get("/api/v1/investigations")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        # Strict descending id tie breaker
        assert [item["id"] for item in data] == [inv3.id, inv2.id, inv1.id]

    def test_pagination_limit_and_offset(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify pagination slices records correctly using limit and offset."""
        biz, user, token = _provision_tenant(db_session, "Page Biz", "page@nexus.test")
        client = auth_client_factory(token)

        now = datetime.now(timezone.utc)
        invs = [
            _seed_investigation(db_session, biz.id, user.id, question=f"Page Q{i}", created_at=now - timedelta(minutes=10 - i))
            for i in range(5)
        ]
        # In newest-first order: invs[4], invs[3], invs[2], invs[1], invs[0]
        expected_ids = [invs[i].id for i in range(4, -1, -1)]

        # Page 1: limit=2, offset=0 -> first 2
        res1 = client.get("/api/v1/investigations?limit=2&offset=0")
        assert res1.status_code == 200
        data1 = res1.json()
        assert len(data1) == 2
        assert [item["id"] for item in data1] == expected_ids[:2]

        # Page 2: limit=2, offset=2 -> next 2
        res2 = client.get("/api/v1/investigations?limit=2&offset=2")
        assert res2.status_code == 200
        data2 = res2.json()
        assert len(data2) == 2
        assert [item["id"] for item in data2] == expected_ids[2:4]

        # Page 3: limit=2, offset=4 -> remaining 1
        res3 = client.get("/api/v1/investigations?limit=2&offset=4")
        assert res3.status_code == 200
        data3 = res3.json()
        assert len(data3) == 1
        assert [item["id"] for item in data3] == [expected_ids[4]]


# ---------------------------------------------------------------------------
# 2. Security & Tenant Isolation Tests
# ---------------------------------------------------------------------------

class TestInvestigationHistorySecurity:
    """Security, tenant-scoping, and IDOR protection tests."""

    def test_unauthenticated_requests_rejected(
        self,
        unauth_client: TestClient,
    ):
        """Verify unauthenticated requests to both list and detail return 401."""
        res_list = unauth_client.get("/api/v1/investigations")
        assert res_list.status_code == 401

        res_detail = unauth_client.get("/api/v1/investigations/1")
        assert res_detail.status_code == 401

    def test_tenant_list_isolation(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify Tenant A and Tenant B only see their own investigation history."""
        biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant Alpha", "alpha@iso.test")
        biz_b, user_b, token_b = _provision_tenant(db_session, "Tenant Beta", "beta@iso.test")

        client_a = auth_client_factory(token_a)
        client_b = auth_client_factory(token_b)

        inv_a = _seed_investigation(db_session, biz_a.id, user_a.id, question="Alpha question?")
        inv_b = _seed_investigation(db_session, biz_b.id, user_b.id, question="Beta question?")

        # Tenant A sees only Alpha
        res_a = client_a.get("/api/v1/investigations")
        assert res_a.status_code == 200
        data_a = res_a.json()
        assert len(data_a) == 1
        assert data_a[0]["id"] == inv_a.id
        assert data_a[0]["question"] == "Alpha question?"

        # Tenant B sees only Beta
        res_b = client_b.get("/api/v1/investigations")
        assert res_b.status_code == 200
        data_b = res_b.json()
        assert len(data_b) == 1
        assert data_b[0]["id"] == inv_b.id
        assert data_b[0]["question"] == "Beta question?"

    def test_cross_tenant_detail_returns_404_no_leakage(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """
        Verify cross-tenant detail lookup strictly returns 404 Not Found (IDOR prevention).
        Confirms no metadata, answer, question, or existence is leaked.
        """
        biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant A", "user.a@idor.test")
        biz_b, user_b, token_b = _provision_tenant(db_session, "Tenant B", "user.b@idor.test")

        client_b = auth_client_factory(token_b)

        inv_a = _seed_investigation(
            db_session,
            business_id=biz_a.id,
            user_id=user_a.id,
            question="Confidential Alpha Question",
            answer="Secret Alpha Answer with $999,999",
        )

        # Tenant B attempts to access Tenant A's investigation
        res = client_b.get(f"/api/v1/investigations/{inv_a.id}")
        assert res.status_code == 404

        res_json = res.json()
        # Must not disclose question, answer, existence, or tenant info
        assert "Confidential" not in str(res_json)
        assert "Secret" not in str(res_json)
        assert "999,999" not in str(res_json)
        assert "Tenant A" not in str(res_json)

    def test_client_business_id_override_attempt_ignored(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """
        Verify client-supplied business_id query parameter cannot override authenticated scope.
        Tenant A requesting ?business_id=<Tenant B> receives only Tenant A records.
        """
        biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant A Biz", "user.a@override.test")
        biz_b, user_b, token_b = _provision_tenant(db_session, "Tenant B Biz", "user.b@override.test")

        client_a = auth_client_factory(token_a)

        inv_a = _seed_investigation(db_session, biz_a.id, user_a.id, question="Tenant A Question")
        _seed_investigation(db_session, biz_b.id, user_b.id, question="Tenant B Question")

        # Tenant A tries to query Tenant B's data via query param
        res = client_a.get(f"/api/v1/investigations?business_id={biz_b.id}")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["id"] == inv_a.id
        assert data[0]["question"] == "Tenant A Question"

    def test_pagination_never_leaks_cross_tenant_records(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify large offsets or pagination boundaries never expose cross-tenant records."""
        biz_a, user_a, token_a = _provision_tenant(db_session, "Tenant A Page", "user.a@pageiso.test")
        biz_b, user_b, token_b = _provision_tenant(db_session, "Tenant B Page", "user.b@pageiso.test")

        client_a = auth_client_factory(token_a)

        _seed_investigation(db_session, biz_a.id, user_a.id, question="Alpha record")
        _seed_investigation(db_session, biz_b.id, user_b.id, question="Beta record")

        # Tenant A queries with offset=1 (beyond Tenant A's 1 record)
        res = client_a.get("/api/v1/investigations?offset=1&limit=50")
        assert res.status_code == 200
        # Must return empty list, NOT Tenant B's record
        assert res.json() == []


# ---------------------------------------------------------------------------
# 3. Validation Tests
# ---------------------------------------------------------------------------

class TestInvestigationHistoryValidation:
    """Validation tests for query parameter bounds and formats."""

    def test_pagination_bounds_validation(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify bounded parameter validation for limit and offset."""
        biz, user, token = _provision_tenant(db_session, "Bounds Biz", "bounds@nexus.test")
        client = auth_client_factory(token)

        _seed_investigation(db_session, biz.id, user.id)

        # Valid boundaries
        assert client.get("/api/v1/investigations?limit=1").status_code == 200
        assert client.get("/api/v1/investigations?limit=100").status_code == 200
        assert client.get("/api/v1/investigations?offset=0").status_code == 200

        # Invalid bounds -> 422
        assert client.get("/api/v1/investigations?limit=0").status_code == 422
        assert client.get("/api/v1/investigations?limit=101").status_code == 422
        assert client.get("/api/v1/investigations?limit=-1").status_code == 422
        assert client.get("/api/v1/investigations?offset=-1").status_code == 422
        assert client.get("/api/v1/investigations?limit=invalid").status_code == 422
        assert client.get("/api/v1/investigations?offset=invalid").status_code == 422

    def test_invalid_investigation_id_returns_422(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify non-integer investigation IDs return 422, not 500."""
        _, _, token = _provision_tenant(db_session, "ID Val Biz", "idval@nexus.test")
        client = auth_client_factory(token)

        res = client.get("/api/v1/investigations/not-an-int")
        assert res.status_code == 422

    def test_large_valid_offset_returns_empty_list(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """Verify large valid offset returns 200 with empty list."""
        biz, user, token = _provision_tenant(db_session, "Large Offset Biz", "offset@nexus.test")
        client = auth_client_factory(token)

        _seed_investigation(db_session, biz.id, user.id)

        res = client.get("/api/v1/investigations?offset=10000")
        assert res.status_code == 200
        assert res.json() == []


# ---------------------------------------------------------------------------
# 4. Persistence Compatibility & User Nullability Tests
# ---------------------------------------------------------------------------

class TestInvestigationHistoryCompatibility:
    """Verify compatibility with nullable user_id (ON DELETE SET NULL)."""

    def test_investigation_with_null_user_id_is_retrievable(
        self,
        db_session: Session,
        auth_client_factory,
    ):
        """
        Verify an investigation whose user_id is NULL remains retrievable in list and detail.
        Ensures audit history does not depend on a live user relationship.
        """
        biz, user, token = _provision_tenant(db_session, "Null User Biz", "nulluser@nexus.test")
        client = auth_client_factory(token)

        # Seed with user_id=None
        inv_null_user = _seed_investigation(
            db_session,
            business_id=biz.id,
            user_id=None,
            question="Audit query by deleted user",
            answer="Answer remains preserved.",
        )

        # List retrieval
        res_list = client.get("/api/v1/investigations")
        assert res_list.status_code == 200
        data_list = res_list.json()
        assert len(data_list) == 1
        assert data_list[0]["id"] == inv_null_user.id
        assert data_list[0]["question"] == "Audit query by deleted user"

        # Detail retrieval
        res_detail = client.get(f"/api/v1/investigations/{inv_null_user.id}")
        assert res_detail.status_code == 200
        data_detail = res_detail.json()
        assert data_detail["id"] == inv_null_user.id
        assert data_detail["answer"] == "Answer remains preserved."
