"""
Integration tests for Authentication API endpoints (/auth/register, /auth/login, /auth/me).
Phase 8: Milestone 1 Security Suite.
"""
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.core.security import create_access_token
from models.business import Business
from models.user import User


def test_auth_register_success_atomic(unauth_client: TestClient, db_session: Session):
    """Test POST /api/v1/auth/register creates both Business and OWNER User atomically and returns JWT."""
    payload = {
        "business_name": "Apex Logistics",
        "business_industry": "Supply Chain",
        "email": "Owner@ApexLogistics.com",
        "password": "StrongPassword123",
    }
    res = unauth_client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["business_name"] == "Apex Logistics"
    assert data["user"]["email"] == "owner@apexlogistics.com"  # Normalized lowercase
    assert data["user"]["role"] == "OWNER"
    assert data["user"]["is_active"] is True
    assert "password_hash" not in data["user"]
    assert "password" not in data["user"]


def test_auth_register_duplicate_email_rejected_409(unauth_client: TestClient):
    """Verify that registering with an existing email (case-insensitive) returns 409 Conflict."""
    payload = {
        "business_name": "First Enterprise",
        "business_industry": "Tech",
        "email": "lead@enterprise.com",
        "password": "Password123",
    }
    res1 = unauth_client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt with uppercase variation of same email
    payload_dup = {
        "business_name": "Second Enterprise",
        "business_industry": "Tech",
        "email": "LEAD@ENTERPRISE.COM",
        "password": "Password456",
    }
    res2 = unauth_client.post("/api/v1/auth/register", json=payload_dup)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_auth_register_weak_password_rejected(unauth_client: TestClient):
    """Verify that weak passwords return 422 Unprocessable Entity."""
    payload = {
        "business_name": "Acme Co",
        "business_industry": "Retail",
        "email": "user@acme.com",
        "password": "short",
    }
    res = unauth_client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 422


def test_auth_login_success(unauth_client: TestClient):
    """Test POST /api/v1/auth/login succeeds with valid credentials and normalized email."""
    # Register first
    reg_payload = {
        "business_name": "Login Test Store",
        "business_industry": "E-Commerce",
        "email": "manager@store.com",
        "password": "ValidLoginPassword1",
    }
    reg_res = unauth_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201

    # Login with case variation
    login_res = unauth_client.post("/api/v1/auth/login", json={
        "email": "MANAGER@STORE.COM",
        "password": "ValidLoginPassword1",
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "manager@store.com"
    assert login_data["business_name"] == "Login Test Store"


def test_auth_login_invalid_password_returns_401(unauth_client: TestClient):
    """Verify that wrong password returns 401 Unauthorized without leaking detail."""
    unauth_client.post("/api/v1/auth/register", json={
        "business_name": "Secure Vault",
        "business_industry": "Security",
        "email": "guard@vault.com",
        "password": "CorrectPassword123",
    })

    res = unauth_client.post("/api/v1/auth/login", json={
        "email": "guard@vault.com",
        "password": "WrongPassword999",
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_auth_login_nonexistent_user_returns_401(unauth_client: TestClient):
    """Verify that nonexistent user email returns 401 without revealing whether the email exists."""
    res = unauth_client.post("/api/v1/auth/login", json={
        "email": "ghost@nonexistent.com",
        "password": "Password123",
    })
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["detail"]


def test_auth_login_inactive_user_returns_401(unauth_client: TestClient, db_session: Session):
    """Verify that deactivated user account is rejected upon login with 401."""
    reg_res = unauth_client.post("/api/v1/auth/register", json={
        "business_name": "Inactive Co",
        "business_industry": "Services",
        "email": "inactive@test.com",
        "password": "Password123",
    })
    user_id = reg_res.json()["user"]["id"]

    # Deactivate user directly in DB
    user = db_session.get(User, user_id)
    user.is_active = False
    db_session.commit()

    res = unauth_client.post("/api/v1/auth/login", json={
        "email": "inactive@test.com",
        "password": "Password123",
    })
    assert res.status_code == 401
    assert "deactivated" in res.json()["detail"].lower()


def test_auth_me_endpoint_success(unauth_client: TestClient):
    """Test GET /api/v1/auth/me returns verified user and business details."""
    reg_res = unauth_client.post("/api/v1/auth/register", json={
        "business_name": "Me Endpoint Biz",
        "business_industry": "Analytics",
        "email": "operator@me.com",
        "password": "Password123",
    })
    token = reg_res.json()["access_token"]

    me_res = unauth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user"]["email"] == "operator@me.com"
    assert me_data["business_name"] == "Me Endpoint Biz"
    assert me_data["business_industry"] == "Analytics"
    assert "password_hash" not in me_data["user"]


def test_auth_me_no_token_returns_401(unauth_client: TestClient):
    """Verify unauthenticated request to /auth/me returns 401."""
    res = unauth_client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_auth_me_tampered_token_returns_401(unauth_client: TestClient):
    """Verify tampered token to /auth/me returns 401."""
    res = unauth_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.fake.token"})
    assert res.status_code == 401
