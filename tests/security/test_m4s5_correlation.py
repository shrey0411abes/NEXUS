"""
M4-S5 Focused Regression and Behavioral Test Suite:
Request Correlation & Structured Observability.
"""
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import List

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.correlation import (
    get_request_id,
    is_valid_request_id,
)
from app.core.security import create_access_token, hash_password
from app.main import app
from models.business import Business
from models.user import User


# ---------------------------------------------------------------------------
# FIXTURES & HELPERS
# ---------------------------------------------------------------------------

@pytest.fixture
def member_auth_client(db_session: Session, auth_client_factory) -> TestClient:
    """Provide a test client authenticated as a MEMBER user."""
    test_biz = Business(name="Correlation Member Corp", industry="Retail")
    db_session.add(test_biz)
    db_session.flush()

    member_user = User(
        business_id=test_biz.id,
        email="member_corr@nexus.test",
        password_hash=hash_password("StrongPass123"),
        role="MEMBER",
        is_active=True,
    )
    db_session.add(member_user)
    db_session.commit()
    db_session.refresh(test_biz)
    db_session.refresh(member_user)

    token = create_access_token(
        subject=str(member_user.id),
        business_id=test_biz.id,
        role=member_user.role,
    )
    return auth_client_factory(token)


# ---------------------------------------------------------------------------
# 1. REQUEST ID PRESENCE & FORMAT
# ---------------------------------------------------------------------------

def test_response_contains_x_request_id_header(unauth_client: TestClient):
    """Verify that every HTTP response receives a non-empty X-Request-ID header."""
    resp = unauth_client.get("/health")
    assert resp.status_code == 200
    req_id = resp.headers.get("x-request-id")
    assert req_id is not None
    assert len(req_id) > 0


def test_generated_request_id_is_valid_uuid4(unauth_client: TestClient):
    """Verify that server-generated request IDs conform to standard UUID4 format."""
    resp = unauth_client.get("/health")
    assert resp.status_code == 200
    req_id = resp.headers.get("x-request-id")
    assert req_id is not None
    # Parse as UUID4 to verify validity
    parsed_uuid = uuid.UUID(req_id, version=4)
    assert str(parsed_uuid) == req_id


# ---------------------------------------------------------------------------
# 2. INCOMING ID VALIDATION & PROPAGATION
# ---------------------------------------------------------------------------

def test_valid_incoming_request_id_propagated(unauth_client: TestClient):
    """Verify that a safe, valid incoming X-Request-ID is preserved and returned."""
    custom_id = "req_custom-test-trace-12345"
    resp = unauth_client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id") == custom_id


def test_valid_incoming_uuid_propagated(unauth_client: TestClient):
    """Verify that a standard UUID4 passed in X-Request-ID is preserved."""
    client_uuid = str(uuid.uuid4())
    resp = unauth_client.get("/health", headers={"X-Request-ID": client_uuid})
    assert resp.status_code == 200
    assert resp.headers.get("x-request-id") == client_uuid


def test_malformed_html_incoming_id_replaced_with_uuid(unauth_client: TestClient):
    """Verify that malformed/script injection in X-Request-ID is rejected and replaced safely."""
    malformed_id = "<script>alert('xss')</script>"
    resp = unauth_client.get("/health", headers={"X-Request-ID": malformed_id})
    assert resp.status_code == 200
    returned_id = resp.headers.get("x-request-id")
    assert returned_id != malformed_id
    assert "<" not in returned_id
    assert ">" not in returned_id
    # Must be replaced with a valid UUID4
    parsed = uuid.UUID(returned_id, version=4)
    assert str(parsed) == returned_id


def test_oversized_incoming_id_replaced_with_uuid(unauth_client: TestClient):
    """Verify that incoming X-Request-ID exceeding 128 characters is rejected and replaced."""
    oversized_id = "a" * 200
    resp = unauth_client.get("/health", headers={"X-Request-ID": oversized_id})
    assert resp.status_code == 200
    returned_id = resp.headers.get("x-request-id")
    assert returned_id != oversized_id
    assert len(returned_id) < 128
    parsed = uuid.UUID(returned_id, version=4)
    assert str(parsed) == returned_id


def test_crlf_control_characters_incoming_id_replaced(unauth_client: TestClient):
    """Verify that CRLF and control characters in X-Request-ID are rejected and replaced."""
    injected_id = "evil\r\nInjected-Header: bad"
    resp = unauth_client.get("/health", headers={"X-Request-ID": injected_id})
    assert resp.status_code == 200
    returned_id = resp.headers.get("x-request-id")
    assert returned_id != injected_id
    assert "\r" not in returned_id
    assert "\n" not in returned_id
    parsed = uuid.UUID(returned_id, version=4)
    assert str(parsed) == returned_id


def test_whitespace_only_incoming_id_replaced(unauth_client: TestClient):
    """Verify that whitespace-only incoming X-Request-ID is rejected and replaced."""
    resp = unauth_client.get("/health", headers={"X-Request-ID": "   "})
    assert resp.status_code == 200
    returned_id = resp.headers.get("x-request-id")
    assert returned_id != "   "
    parsed = uuid.UUID(returned_id, version=4)
    assert str(parsed) == returned_id


# ---------------------------------------------------------------------------
# 3. GUARANTEED X-REQUEST-ID ACROSS ALL RESPONSE CLASSES
# ---------------------------------------------------------------------------

def test_2xx_response_contains_request_id(client: TestClient):
    """Verify normal 200 OK responses contain X-Request-ID."""
    resp = client.get("/api/v1/products")
    assert resp.status_code == 200
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


def test_401_unauthorized_response_contains_request_id(unauth_client: TestClient):
    """Verify 401 Unauthorized responses contain X-Request-ID."""
    resp = unauth_client.get("/api/v1/businesses/me")
    assert resp.status_code == 401
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


def test_403_forbidden_response_contains_request_id(member_auth_client: TestClient):
    """Verify 403 Forbidden responses contain X-Request-ID."""
    # MEMBER role cannot create products
    product_payload = {
        "name": "M4S5 Test Product",
        "sku": "SKU-M4S5-001",
        "category": "Electronics",
        "price": 100.0,
        "cost": 50.0,
    }
    resp = member_auth_client.post("/api/v1/products", json=product_payload)
    assert resp.status_code == 403
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


def test_404_not_found_response_contains_request_id(unauth_client: TestClient):
    """Verify 404 Not Found responses contain X-Request-ID."""
    resp = unauth_client.get("/api/v1/nonexistent-test-route-m4s5")
    assert resp.status_code == 404
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


def test_413_payload_too_large_contains_request_id(unauth_client: TestClient):
    """Verify 413 Payload Too Large responses contain X-Request-ID."""
    limit = settings.MAX_REQUEST_BODY_SIZE
    oversized_data = b"B" * (limit + 1024)
    resp = unauth_client.post(
        "/api/v1/auth/login",
        content=oversized_data,
        headers={"Content-Type": "application/json"},
    )
    assert resp.status_code == 413
    assert "x-request-id" in resp.headers
    assert len(resp.headers["x-request-id"]) > 0


def test_429_rate_limited_contains_request_id(unauth_client: TestClient):
    """Verify 429 Too Many Requests responses contain X-Request-ID."""
    login_payload = {
        "email": "rate_limited_test@nexus.test",
        "password": "WrongPassword123!",
    }
    # Trigger 5 login attempts
    for _ in range(5):
        unauth_client.post("/api/v1/auth/login", json=login_payload)

    # 6th attempt triggers 429
    resp_429 = unauth_client.post("/api/v1/auth/login", json=login_payload)
    assert resp_429.status_code == 429
    assert "x-request-id" in resp_429.headers
    assert len(resp_429.headers["x-request-id"]) > 0


def test_500_internal_error_contains_request_id_and_no_leak(unauth_client: TestClient):
    """
    Verify handled 500 Internal Server Error responses contain X-Request-ID,
    and strictly return generic error detail without leaking stack traces.
    """
    # Temporarily register a test route that raises an unhandled exception
    test_router = APIRouter()

    @test_router.get("/test-internal-error-m4s5")
    def trigger_error():
        raise RuntimeError("Sensitive internal database connection error: secret_db_url=postgres://admin:pwd@host")

    app.include_router(test_router, prefix="/api/v1")

    try:
        resp = unauth_client.get("/api/v1/test-internal-error-m4s5")
        assert resp.status_code == 500
        assert "x-request-id" in resp.headers
        assert len(resp.headers["x-request-id"]) > 0

        data = resp.json()
        assert data["detail"] == "An internal server error occurred."
        assert "secret_db_url" not in resp.text
        assert "RuntimeError" not in resp.text
        assert "Traceback" not in resp.text
    finally:
        # Remove test route from app routes to keep app clean
        app.routes[:] = [r for r in app.routes if getattr(r, "path", "") != "/api/v1/test-internal-error-m4s5"]


# ---------------------------------------------------------------------------
# 4. CONCURRENCY & ASYNC ISOLATION
# ---------------------------------------------------------------------------

def test_concurrent_requests_maintain_distinct_request_ids(unauth_client: TestClient):
    """Verify concurrent requests without incoming IDs generate completely distinct IDs."""
    num_requests = 20

    def make_request():
        r = unauth_client.get("/health")
        return r.headers.get("x-request-id")

    with ThreadPoolExecutor(max_workers=5) as executor:
        ids = list(executor.map(lambda _: make_request(), range(num_requests)))

    assert len(ids) == num_requests
    assert all(rid is not None and len(rid) > 0 for rid in ids)
    # Every request must have a distinct ID
    assert len(set(ids)) == num_requests


def test_concurrent_requests_preserve_matching_client_ids(unauth_client: TestClient):
    """Verify concurrent requests with unique incoming IDs return their exact corresponding ID."""
    num_requests = 15

    def make_request(idx: int):
        client_id = f"test-concurrent-trace-{idx:03d}"
        r = unauth_client.get("/health", headers={"X-Request-ID": client_id})
        return client_id, r.headers.get("x-request-id")

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(make_request, range(num_requests)))

    for sent_id, returned_id in results:
        assert sent_id == returned_id


# ---------------------------------------------------------------------------
# 5. STRUCTURED LOGGING & SENSITIVE DATA EXCLUSION
# ---------------------------------------------------------------------------

def test_structured_log_emitted_with_correlation_fields(unauth_client: TestClient, caplog):
    """Verify request lifecycle is logged with structured fields: method, path, status, duration, request_id."""
    logging.getLogger("app.core.correlation").disabled = False
    caplog.set_level(logging.INFO, logger="app.core.correlation")
    custom_id = "lifecycle-log-test-id-001"

    resp = unauth_client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 200

    log_records = [rec for rec in caplog.records if rec.name == "app.core.correlation"]
    assert len(log_records) >= 1

    matching_record = None
    for r in log_records:
        if custom_id in r.message:
            matching_record = r
            break

    assert matching_record is not None
    assert "method=GET" in matching_record.message
    assert "path=/health" in matching_record.message
    assert "status=200" in matching_record.message
    assert "duration_ms=" in matching_record.message
    assert f"request_id={custom_id}" in matching_record.message


def test_authenticated_log_includes_user_and_tenant_context(client: TestClient, caplog):
    """Verify structured request logging captures authenticated user_id and business_id."""
    logging.getLogger("app.core.correlation").disabled = False
    caplog.set_level(logging.INFO, logger="app.core.correlation")

    resp = client.get("/api/v1/products")
    assert resp.status_code == 200
    req_id = resp.headers.get("x-request-id")

    log_records = [rec for rec in caplog.records if rec.name == "app.core.correlation" and req_id in rec.message]
    assert len(log_records) >= 1
    log_rec = log_records[0]

    # user_id and business_id must be present and not '-'
    assert "user_id=" in log_rec.message
    assert "business_id=" in log_rec.message
    assert "user_id=-" not in log_rec.message
    assert "business_id=-" not in log_rec.message


def test_sensitive_tokens_and_credentials_not_logged(unauth_client: TestClient, caplog):
    """Verify Authorization headers, Bearer tokens, and secrets never appear in logs."""
    caplog.set_level(logging.INFO)
    secret_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_token_content"

    unauth_client.get(
        "/api/v1/businesses/me",
        headers={"Authorization": f"Bearer {secret_token}"},
    )

    all_log_text = "\n".join(rec.message for rec in caplog.records)
    assert secret_token not in all_log_text
    assert "Authorization" not in all_log_text


def test_sensitive_passwords_and_bodies_not_logged(unauth_client: TestClient, caplog):
    """Verify passwords and raw request bodies never appear in logs."""
    caplog.set_level(logging.INFO)
    sensitive_password = "SuperSecretPlainTextPassword999!"

    unauth_client.post(
        "/api/v1/auth/login",
        json={"email": "audit_test@nexus.test", "password": sensitive_password},
    )

    all_log_text = "\n".join(rec.message for rec in caplog.records)
    assert sensitive_password not in all_log_text


# ---------------------------------------------------------------------------
# 6. CORS EXPOSE-HEADERS & OBSERVABILITY ISOLATION
# ---------------------------------------------------------------------------

def test_cors_exposes_x_request_id(unauth_client: TestClient):
    """Verify that X-Request-ID is included in Access-Control-Expose-Headers for CORS clients."""
    resp = unauth_client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    exposed = resp.headers.get("access-control-expose-headers", "")
    assert "x-request-id" in exposed.lower()


def test_correlation_id_does_not_grant_authorization(unauth_client: TestClient):
    """
    Verify that correlation ID is strictly for observability and cannot be
    used to bypass authentication or influence authorization decisions.
    """
    resp = unauth_client.get(
        "/api/v1/businesses/me",
        headers={"X-Request-ID": "admin-system-override-token"},
    )
    # Must still be rejected with 401 Unauthorized
    assert resp.status_code == 401
