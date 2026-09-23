"""
Regression and behavioral test suite for M4-S2:
HTTP Security Headers & Request Body Hardening.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.middleware import (
    PayloadTooLargeError,
    RequestSizeLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.main import app


def test_security_headers_present_on_normal_response(client: TestClient):
    """Verify standard security headers are present on normal successful API responses."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"


def test_hsts_omitted_in_development_http(client: TestClient):
    """Verify HSTS is NOT emitted for plain HTTP in non-production environment."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "strict-transport-security" not in response.headers


def test_hsts_emitted_when_request_is_https(client: TestClient):
    """Verify HSTS is emitted when request operates behind HTTPS / TLS proxy."""
    response = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert response.status_code == 200
    hsts = response.headers.get("strict-transport-security")
    assert hsts is not None
    assert "max-age=31536000" in hsts
    assert "includeSubDomains" in hsts


def test_hsts_emitted_when_production_environment(monkeypatch):
    """Verify HSTS is unconditionally emitted when ENVIRONMENT is set to production."""
    test_app = FastAPI()
    test_app.add_middleware(SecurityHeadersMiddleware, is_production=True)

    @test_app.get("/ping")
    def ping():
        return {"status": "ok"}

    with TestClient(test_app) as tc:
        resp = tc.get("/ping")
        assert resp.status_code == 200
        assert resp.headers.get("strict-transport-security") == "max-age=31536000; includeSubDomains"
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"


def test_security_headers_present_on_error_responses(unauth_client: TestClient):
    """Verify security headers are retained on error responses (e.g. 401 Unauthorized, 404 Not Found)."""
    # 401 Unauthorized on protected endpoint
    res_401 = unauth_client.get("/api/v1/businesses/me")
    assert res_401.status_code == 401
    assert res_401.headers.get("x-content-type-options") == "nosniff"
    assert res_401.headers.get("x-frame-options") == "DENY"
    assert res_401.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    # 404 Not Found
    res_404 = unauth_client.get("/api/v1/nonexistent-endpoint-path")
    assert res_404.status_code == 404
    assert res_404.headers.get("x-content-type-options") == "nosniff"
    assert res_404.headers.get("x-frame-options") == "DENY"


def test_request_body_size_boundary_precision():
    """
    Test exact boundary mechanics:
    <= configured limit -> allowed (200)
    > configured limit -> rejected (413)
    """
    boundary_app = FastAPI()
    limit = 1024  # 1 KB boundary test
    boundary_app.add_middleware(RequestSizeLimitMiddleware, max_upload_size=limit)
    boundary_app.add_middleware(SecurityHeadersMiddleware, is_production=False)

    @boundary_app.post("/echo")
    async def echo(request: Request):
        body = await request.body()
        return {"received_bytes": len(body)}

    with TestClient(boundary_app) as tc:
        # 1. Exact boundary: 1024 bytes -> allowed
        payload_exact = b"x" * limit
        res_exact = tc.post("/echo", content=payload_exact, headers={"Content-Type": "application/octet-stream"})
        assert res_exact.status_code == 200
        assert res_exact.json()["received_bytes"] == limit

        # 2. Boundary + 1 byte: 1025 bytes -> rejected with 413
        payload_over = b"x" * (limit + 1)
        res_over = tc.post("/echo", content=payload_over, headers={"Content-Type": "application/octet-stream"})
        assert res_over.status_code == 413
        assert "Request payload exceeds the maximum allowed size" in res_over.json()["detail"]
        assert res_over.headers.get("x-content-type-options") == "nosniff"
        assert res_over.headers.get("x-frame-options") == "DENY"


def test_oversized_payload_rejected_on_main_app(unauth_client: TestClient):
    """
    Verify that an oversized payload (> 2 MB) is rejected with HTTP 413 on the main NEXUS application,
    without executing endpoint logic or leaking internals.
    """
    two_mb = settings.MAX_REQUEST_BODY_SIZE  # 2 * 1024 * 1024 = 2,097,152 bytes
    oversized_bytes = b"A" * (two_mb + 1024)  # Exceeds 2 MB

    res = unauth_client.post(
        "/api/v1/auth/login",
        content=oversized_bytes,
        headers={
            "Content-Type": "application/json",
            "Origin": "http://localhost:5173",
        },
    )

    assert res.status_code == 413
    data = res.json()
    assert "detail" in data
    assert f"exceeds the maximum allowed size of {two_mb} bytes" in data["detail"]

    # Security headers must be present on 413 responses
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    # CORS headers must be present on 413 responses when Origin is specified
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_chunked_streaming_oversized_payload_rejected_413():
    """Verify that chunked streaming requests exceeding the limit are rejected with 413."""
    stream_app = FastAPI()
    limit = 500
    stream_app.add_middleware(RequestSizeLimitMiddleware, max_upload_size=limit)
    stream_app.add_middleware(SecurityHeadersMiddleware, is_production=False)

    @stream_app.post("/stream-upload")
    async def stream_upload(request: Request):
        body = await request.body()
        return {"len": len(body)}

    with TestClient(stream_app) as tc:
        # Generator that streams chunks without Content-Length
        def chunk_generator():
            for _ in range(10):
                yield b"0123456789" * 10  # 100 bytes * 10 = 1000 bytes > 500 limit

        res = tc.post("/stream-upload", content=chunk_generator())
        assert res.status_code == 413
        assert f"exceeds the maximum allowed size of {limit} bytes" in res.json()["detail"]


def test_safe_methods_unaffected(client: TestClient):
    """Verify GET, HEAD, and OPTIONS methods are unaffected by size limit middleware."""
    # GET on main app
    res_get = client.get("/health")
    assert res_get.status_code == 200
    assert res_get.headers.get("x-content-type-options") == "nosniff"

    # OPTIONS preflight on main app
    res_options = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res_options.status_code == 200
    assert res_options.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res_options.headers.get("x-content-type-options") == "nosniff"

    # HEAD on test app with HEAD route
    head_app = FastAPI()
    head_app.add_middleware(RequestSizeLimitMiddleware, max_upload_size=100)
    head_app.add_middleware(SecurityHeadersMiddleware, is_production=False)

    @head_app.head("/ping")
    def ping_head():
        return JSONResponse(status_code=200, content=None)

    with TestClient(head_app) as tc:
        res_head = tc.head("/ping")
        assert res_head.status_code == 200
        assert res_head.headers.get("x-content-type-options") == "nosniff"


def test_normal_authentication_and_api_remain_functional(unauth_client: TestClient, db_session: Session):
    """Verify that legitimate authentication requests (< 2 MB) remain fully functional."""
    register_payload = {
        "business_name": "Hardening Test Enterprise",
        "business_industry": "Cybersecurity",
        "email": "security@hardening.test",
        "password": "ValidPassword123!",
    }
    reg_res = unauth_client.post("/api/v1/auth/register", json=register_payload)
    assert reg_res.status_code == 201
    assert "access_token" in reg_res.json()
    assert reg_res.headers.get("x-content-type-options") == "nosniff"
    assert reg_res.headers.get("x-frame-options") == "DENY"

    # Legitimate login request
    login_payload = {
        "email": "security@hardening.test",
        "password": "ValidPassword123!",
    }
    login_res = unauth_client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()
    assert login_res.headers.get("x-content-type-options") == "nosniff"
