"""Security utilities for password hashing, validation, and JWT token management."""
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from app.core.config import settings


class PasswordValidationError(ValueError):
    """Raised when a password fails complexity requirements."""
    pass


def validate_password_strength(password: str) -> bool:
    """
    Validate that a password meets production security baseline:
    - At least 8 characters
    - At most 72 bytes (bcrypt maximum input length to prevent silent truncation)
    - At least one letter (a-z, A-Z)
    - At least one number (0-9)
    """
    if len(password) < 8:
        raise PasswordValidationError("Password must be at least 8 characters long.")
    if len(password.encode("utf-8")) > 72:
        raise PasswordValidationError("Password cannot exceed 72 bytes.")
    if not re.search(r"[a-zA-Z]", password):
        raise PasswordValidationError("Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise PasswordValidationError("Password must contain at least one numeric digit.")
    return True


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt with a freshly generated unique salt.
    Enforces password complexity prior to hashing.
    """
    validate_password_strength(password)
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hashed password string.
    Returns False on any decoding error or mismatch without leaking details.
    """
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    subject: str,
    business_id: int,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token for an authenticated user identity.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "biz_id": int(business_id),
        "role": str(role),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify the signature and expiration of a JWT access token.
    Raises jwt.PyJWTError on failure.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["sub", "exp", "iat"]},
    )
