"""
Tests for JWT Token Generation, Verification, Expiration, and Tampering.
Phase 8: Milestone 1 Security Suite.
"""
from datetime import timedelta
import pytest
import jwt
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token


def test_jwt_token_generation_and_decoding():
    """Verify that create_access_token produces a verifiable JWT with all required claims."""
    token = create_access_token(
        subject="42",
        business_id=10,
        role="OWNER",
        expires_delta=timedelta(minutes=30),
    )
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload["sub"] == "42"
    assert payload["biz_id"] == 10
    assert payload["role"] == "OWNER"
    assert "iat" in payload
    assert "exp" in payload
    assert payload["exp"] > payload["iat"]


def test_jwt_expiration_rejected():
    """Verify that an expired JWT is rejected with ExpiredSignatureError."""
    expired_token = create_access_token(
        subject="1",
        business_id=1,
        role="OWNER",
        expires_delta=timedelta(seconds=-10),  # Expired in past
    )

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(expired_token)


def test_jwt_tampered_payload_rejected():
    """Verify that altering JWT signature or payload causes decode failure."""
    valid_token = create_access_token(
        subject="1",
        business_id=1,
        role="MEMBER",
    )

    # Tamper with token structure (e.g. modify characters in payload section)
    parts = valid_token.split(".")
    assert len(parts) == 3
    tampered_token = f"{parts[0]}.eyJyZXBsYWNlZCI6IHRydWV9.{parts[2]}"

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tampered_token)


def test_jwt_wrong_secret_key_rejected():
    """Verify that a token signed with a different secret key is rejected."""
    payload = {"sub": "1", "biz_id": 1, "role": "OWNER", "iat": 1000, "exp": 9999999999}
    foreign_token = jwt.encode(payload, "completely-different-secret-key-32chars", algorithm="HS256")

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(foreign_token)


def test_jwt_malformed_string_rejected():
    """Verify that non-JWT or malformed strings are rejected."""
    with pytest.raises(jwt.PyJWTError):
        decode_access_token("not-a-valid-jwt-token")

    with pytest.raises(jwt.PyJWTError):
        decode_access_token("")


def test_jwt_missing_required_claims():
    """Verify that tokens missing required claims (sub, exp, iat) are rejected."""
    incomplete_payload = {"role": "OWNER"}
    incomplete_token = jwt.encode(incomplete_payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(incomplete_token)


def test_production_jwt_secret_validation():
    """
    Verify that in production environment:
    - Default/insecure JWT_SECRET_KEY values are rejected.
    - Secrets shorter than 32 characters are rejected.
    - Cryptographically strong 32+ char secrets are accepted.
    """
    from app.core.config import Settings

    # Insecure default in production -> ValueError
    with pytest.raises(ValueError, match="Insecure or default JWT_SECRET_KEY"):
        Settings(ENVIRONMENT="production", JWT_SECRET_KEY="nexus-insecure-dev-secret-key-change-in-production-32chars")

    # Short secret in production -> ValueError
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(ENVIRONMENT="production", JWT_SECRET_KEY="short-secret-under-32-chars")

    # Strong 32+ char secret in production -> Success
    prod_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="c4f82a9b31d04e7685bf61e3892d1a0e_production_secret_512bits_secure",
    )
    assert prod_settings.JWT_SECRET_KEY.startswith("c4f82a9b31d04e7685bf61e3892d1a0e")

