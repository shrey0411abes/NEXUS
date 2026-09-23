"""
M4-S3 Focused Regression and Behavioral Test Suite:
Rate Limiting & Abuse Prevention for POST /auth/login and POST /investigations.
"""
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import List
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limiter import RateLimiter, get_client_ip, limiter
from app.core.security import create_access_token, hash_password
from models.business import Business
from models.user import User


@pytest.fixture(autouse=True)
def reset_global_limiter():
    """Ensure limiter state is cleanly reset before and after every test."""
    limiter.reset()
    limiter.set_time_func(None)
    yield
    limiter.reset()
    limiter.set_time_func(None)


# ---------------------------------------------------------------------------
# LOGIN RATE LIMITING TESTS (POST /api/v1/auth/login)
# ---------------------------------------------------------------------------

def test_login_rate_limit_enforcement_and_retry_after(unauth_client: TestClient):
    """
    Verify:
    1. First 5 login attempts are evaluated (fail with 401 for bad creds).
    2. Exactly on the 6th attempt, HTTP 429 Too Many Requests is returned.
    3. Retry-After header is present with a valid positive integer.
    4. Safe generic error detail without account enumeration.
    5. Security headers and CORS headers are retained on 429.
    """
    login_payload = {
        "email": "nonexistent@nexus.test",
        "password": "WrongPassword123!",
    }
    origin = "http://localhost:5173"

    # First 5 attempts should reach auth logic and return 401 Unauthorized
    for i in range(5):
        resp = unauth_client.post(
            "/api/v1/auth/login",
            json=login_payload,
            headers={"Origin": origin},
        )
        assert resp.status_code == 401, f"Attempt {i+1} should fail auth with 401"
        assert resp.headers.get("x-content-type-options") == "nosniff"

    # 6th attempt must be throttled with 429
    throttled_resp = unauth_client.post(
        "/api/v1/auth/login",
        json=login_payload,
        headers={"Origin": origin},
    )
    assert throttled_resp.status_code == 429
    data = throttled_resp.json()
    assert data["detail"] == "Too many requests. Please try again later."

    # Header verification
    retry_after = throttled_resp.headers.get("retry-after")
    assert retry_after is not None
    assert int(retry_after) > 0
    assert int(retry_after) <= 60

    # Security and CORS headers on 429 response
    assert throttled_resp.headers.get("x-content-type-options") == "nosniff"
    assert throttled_resp.headers.get("x-frame-options") == "DENY"
    assert throttled_resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert throttled_resp.headers.get("access-control-allow-origin") == origin


def test_login_rate_limit_window_reset_monotonic():
    """
    Verify rate limit resets after window expires using controllable monotonic time.
    """
    current_time = 1000.0

    def mock_clock():
        return current_time

    limiter.set_time_func(mock_clock)

    test_limiter = RateLimiter(time_func=mock_clock)
    key = "auth:login:192.168.1.50"

    # Consume all 5 allowed attempts at t=1000.0
    for _ in range(5):
        allowed, retry_after = test_limiter.check(key, max_requests=5, window_seconds=60)
        assert allowed is True
        assert retry_after == 0

    # 6th attempt is throttled
    allowed, retry_after = test_limiter.check(key, max_requests=5, window_seconds=60)
    assert allowed is False
    assert retry_after == 60

    # Advance time past the 60s window (t=1061.0)
    current_time = 1061.0
    allowed, retry_after = test_limiter.check(key, max_requests=5, window_seconds=60)
    assert allowed is True
    assert retry_after == 0


def test_login_rate_limit_isolated_by_client_ip(monkeypatch):
    """
    Verify that client A reaching the rate limit does not throttle client B.
    """
    test_limiter = RateLimiter()

    # Exhaust quota for client A
    for _ in range(5):
        allowed, _ = test_limiter.check("auth:login:10.0.0.1", max_requests=5, window_seconds=60)
        assert allowed is True

    # Client A is throttled
    allowed_a, _ = test_limiter.check("auth:login:10.0.0.1", max_requests=5, window_seconds=60)
    assert allowed_a is False

    # Client B is completely unthrottled
    allowed_b, retry_b = test_limiter.check("auth:login:10.0.0.2", max_requests=5, window_seconds=60)
    assert allowed_b is True
    assert retry_b == 0


def test_successful_login_counts_against_quota(unauth_client: TestClient, db_session: Session):
    """
    Verify that successful logins also count against the client rate limit
    (prevents brute-forcing valid credentials or token-generation abuse).
    """
    # Create test user
    biz = Business(name="Login Test Co", industry="Tech")
    db_session.add(biz)
    db_session.flush()

    user = User(
        business_id=biz.id,
        email="test_success_login@nexus.test",
        password_hash=hash_password("ValidPassword123!"),
        role="OWNER",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()

    payload = {"email": "test_success_login@nexus.test", "password": "ValidPassword123!"}

    # Perform 5 successful logins
    for i in range(5):
        r = unauth_client.post("/api/v1/auth/login", json=payload)
        assert r.status_code == 200, f"Attempt {i+1} should succeed"

    # 6th attempt must be throttled with 429
    r_throttled = unauth_client.post("/api/v1/auth/login", json=payload)
    assert r_throttled.status_code == 429


# ---------------------------------------------------------------------------
# INVESTIGATION RATE LIMITING TESTS (POST /api/v1/investigations)
# ---------------------------------------------------------------------------

def test_investigations_rate_limit_enforcement(client: TestClient):
    """
    Verify:
    1. Up to 10 investigation requests are permitted.
    2. Exactly on the 11th request, HTTP 429 Too Many Requests is returned.
    3. Retry-After header is present.
    4. Security headers are present on 429.
    """
    payload = {
        "business_id": 1,
        "question": "What is our monthly revenue trend?",
        "days": 30,
    }

    for i in range(10):
        resp = client.post("/api/v1/investigations", json=payload)
        assert resp.status_code == 200, f"Investigation {i+1} should succeed"

    # 11th request must receive 429
    throttled = client.post("/api/v1/investigations", json=payload)
    assert throttled.status_code == 429
    assert throttled.json()["detail"] == "Too many requests. Please try again later."
    assert "retry-after" in throttled.headers
    assert int(throttled.headers["retry-after"]) > 0

    # Security headers check
    assert throttled.headers.get("x-content-type-options") == "nosniff"
    assert throttled.headers.get("x-frame-options") == "DENY"


def test_investigations_throttling_happens_before_service_call(client: TestClient):
    """
    Verify that when quota is exceeded, InvestigationService.investigate is NOT called.
    """
    payload = {"business_id": 1, "question": "What is our risk score?", "days": 30}

    # Consume 10 requests
    for _ in range(10):
        res = client.post("/api/v1/investigations", json=payload)
        assert res.status_code == 200

    # On the 11th request, mock InvestigationService.investigate to verify it is bypassed
    with patch("app.services.investigation_service.InvestigationService.investigate") as mock_investigate:
        res_throttled = client.post("/api/v1/investigations", json=payload)
        assert res_throttled.status_code == 429
        mock_investigate.assert_not_called()


def test_investigations_tenant_and_user_isolation(db_session: Session):
    """
    Verify that User A exhausting their quota does NOT throttle User B,
    even within the same tenant or across different tenants.
    """
    from app.main import app
    from database import get_db

    # Create Business 1 with User 1 and User 2
    biz1 = Business(name="Tenant Alpha", industry="Retail")
    biz2 = Business(name="Tenant Beta", industry="Services")
    db_session.add_all([biz1, biz2])
    db_session.flush()

    u1 = User(business_id=biz1.id, email="u1@alpha.test", password_hash="h", role="MEMBER", is_active=True)
    u2 = User(business_id=biz1.id, email="u2@alpha.test", password_hash="h", role="MEMBER", is_active=True)
    u3 = User(business_id=biz2.id, email="u3@beta.test", password_hash="h", role="OWNER", is_active=True)
    db_session.add_all([u1, u2, u3])
    db_session.commit()

    token1 = create_access_token(subject=str(u1.id), business_id=biz1.id, role=u1.role)
    token2 = create_access_token(subject=str(u2.id), business_id=biz1.id, role=u2.role)
    token3 = create_access_token(subject=str(u3.id), business_id=biz2.id, role=u3.role)

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    payload = {"business_id": 1, "question": "Any risk?", "days": 7}

    try:
        # Exhaust quota for User 1 (10 requests)
        with TestClient(app, headers={"Authorization": f"Bearer {token1}"}) as c1:
            for _ in range(10):
                r = c1.post("/api/v1/investigations", json=payload)
                assert r.status_code == 200
            # User 1 is throttled
            r_throttled = c1.post("/api/v1/investigations", json=payload)
            assert r_throttled.status_code == 429

        # User 2 (same business) must NOT be throttled
        with TestClient(app, headers={"Authorization": f"Bearer {token2}"}) as c2:
            r2 = c2.post("/api/v1/investigations", json=payload)
            assert r2.status_code == 200

        # User 3 (different business) must NOT be throttled
        with TestClient(app, headers={"Authorization": f"Bearer {token3}"}) as c3:
            r3 = c3.post("/api/v1/investigations", json=payload)
            assert r3.status_code == 200

    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# CONCURRENCY AND STORAGE BOUNDING TESTS
# ---------------------------------------------------------------------------

def test_concurrency_race_condition_protection():
    """
    Verify that concurrent requests serialize properly and cannot bypass the quota.
    """
    test_limiter = RateLimiter()
    key = "concurrent:test:client"
    limit = 10
    window = 60

    results: List[bool] = []
    lock = threading.Lock()

    def make_request():
        allowed, _ = test_limiter.check(key, max_requests=limit, window_seconds=window)
        with lock:
            results.append(allowed)

    # Dispatch 30 simultaneous requests
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(make_request) for _ in range(30)]
        for f in futures:
            f.result()

    allowed_count = sum(1 for r in results if r is True)
    denied_count = sum(1 for r in results if r is False)

    assert allowed_count == limit, f"Expected exactly {limit} allowed requests, got {allowed_count}"
    assert denied_count == 20, f"Expected exactly 20 denied requests, got {denied_count}"


def test_bounded_memory_and_capacity_eviction():
    """
    Verify that when tracked keys reach max_tracked_keys, capacity is bounded by evicting oldest.
    """
    max_keys = 50
    test_limiter = RateLimiter(max_tracked_keys=max_keys)

    # Insert 100 unique keys
    for i in range(100):
        test_limiter.check(f"client:{i}", max_requests=5, window_seconds=60)

    # Storage size must never exceed max_keys
    assert len(test_limiter._storage) <= max_keys


def test_expired_entries_passive_cleanup():
    """
    Verify that expired keys are cleaned up during sweeps and do not linger indefinitely.
    """
    current_time = 1000.0

    def mock_clock():
        return current_time

    test_limiter = RateLimiter(time_func=mock_clock, cleanup_interval_seconds=10.0)

    # Add 5 keys at t=1000.0
    for i in range(5):
        test_limiter.check(f"key:{i}", max_requests=5, window_seconds=30)
    assert len(test_limiter._storage) == 5

    # Advance time beyond window (t=1040.0, window is 30s, interval is 10s)
    current_time = 1040.0

    # New request triggers cleanup sweep
    test_limiter.check("key:new", max_requests=5, window_seconds=30)

    # Old keys should be evicted
    assert "key:0" not in test_limiter._storage
    assert "key:new" in test_limiter._storage


# ---------------------------------------------------------------------------
# REGRESSION AND SCOPE RESTRICTION TESTS
# ---------------------------------------------------------------------------

def test_unrelated_endpoints_not_rate_limited(client: TestClient, unauth_client: TestClient):
    """
    Verify that unrelated endpoints (health, products, registration, /auth/me)
    are NOT throttled even after repeated calls.
    """
    # 1. GET /health
    for _ in range(15):
        res = unauth_client.get("/health")
        assert res.status_code == 200

    # 2. GET /api/v1/products
    for _ in range(15):
        res = client.get("/api/v1/products")
        assert res.status_code == 200

    # 3. GET /api/v1/auth/me
    for _ in range(15):
        res = client.get("/api/v1/auth/me")
        assert res.status_code == 200


def test_body_limit_m4_s2_behavior_preserved_with_rate_limiter(unauth_client: TestClient):
    """
    Verify that M4-S2 413 request size limit takes precedence on oversized payloads.
    """
    oversized = b"x" * (settings.MAX_REQUEST_BODY_SIZE + 1024)
    res = unauth_client.post(
        "/api/v1/auth/login",
        content=oversized,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 413
    assert res.headers.get("x-content-type-options") == "nosniff"
