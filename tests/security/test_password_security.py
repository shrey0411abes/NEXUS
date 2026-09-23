"""
Tests for Password Security, Hashing, Validation, and Salt Uniqueness.
Phase 8: Milestone 1 Security Suite.
"""
import pytest
from app.core.security import (
    hash_password,
    verify_password,
    validate_password_strength,
    PasswordValidationError,
)


def test_password_hash_generation():
    """Verify that hash_password generates a valid bcrypt hash starting with $2b$."""
    raw_pw = "SecurePass123"
    hashed = hash_password(raw_pw)
    assert isinstance(hashed, str)
    assert hashed.startswith("$2b$")
    assert hashed != raw_pw


def test_unique_bcrypt_salts():
    """Verify that hashing the same password twice produces distinct hashes due to unique salts."""
    raw_pw = "SecurePass123"
    hash_1 = hash_password(raw_pw)
    hash_2 = hash_password(raw_pw)
    assert hash_1 != hash_2
    assert verify_password(raw_pw, hash_1) is True
    assert verify_password(raw_pw, hash_2) is True


def test_password_verification_correct_and_incorrect():
    """Verify that verify_password correctly validates matches and rejects mismatches."""
    raw_pw = "CorrectPassword1"
    hashed = hash_password(raw_pw)

    assert verify_password("CorrectPassword1", hashed) is True
    assert verify_password("WrongPassword99", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password("correctpassword1", hashed) is False  # Case-sensitive check


def test_password_complexity_validation():
    """Verify production password strength requirements: >= 8 chars, >= 1 letter, >= 1 digit."""
    # Valid passwords
    assert validate_password_strength("ValidPass1") is True
    assert validate_password_strength("AnotherComplex99!") is True

    # Too short (< 8 chars)
    with pytest.raises(PasswordValidationError, match="at least 8 characters"):
        validate_password_strength("Pass1")

    # Missing letter
    with pytest.raises(PasswordValidationError, match="at least one letter"):
        validate_password_strength("123456789")

    # Missing digit
    with pytest.raises(PasswordValidationError, match="at least one numeric digit"):
        validate_password_strength("abcdefghijkl")


def test_hash_password_enforces_complexity():
    """Verify that hash_password refuses to hash passwords that fail complexity rules."""
    with pytest.raises(PasswordValidationError):
        hash_password("weak")  # Too short

    with pytest.raises(PasswordValidationError):
        hash_password("onlylettershere")  # Missing digits

    with pytest.raises(PasswordValidationError):
        hash_password("1234567890")  # Missing letters


def test_unicode_password_support():
    """Verify that valid Unicode passwords containing letters and digits are correctly validated and hashed."""
    unicode_pw = "Pässwörd123!日本語"
    assert validate_password_strength(unicode_pw) is True
    hashed = hash_password(unicode_pw)
    assert verify_password(unicode_pw, hashed) is True
    assert verify_password("Password123!日本語", hashed) is False


def test_long_password_boundary_and_rejection():
    """
    Verify bcrypt 72-byte maximum input boundary:
    - Passwords up to exactly 72 UTF-8 bytes are valid and hashed.
    - Passwords exceeding 72 UTF-8 bytes are explicitly rejected with PasswordValidationError.
    """
    # Exactly 72 ASCII characters (72 bytes)
    valid_72_byte_pw = "A1" + "a" * 70
    assert len(valid_72_byte_pw.encode("utf-8")) == 72
    assert validate_password_strength(valid_72_byte_pw) is True
    hashed = hash_password(valid_72_byte_pw)
    assert verify_password(valid_72_byte_pw, hashed) is True

    # 73 ASCII characters (73 bytes) -> Exceeds boundary
    invalid_73_byte_pw = "A1" + "a" * 71
    assert len(invalid_73_byte_pw.encode("utf-8")) == 73
    with pytest.raises(PasswordValidationError, match="cannot exceed 72 bytes"):
        validate_password_strength(invalid_73_byte_pw)
    with pytest.raises(PasswordValidationError, match="cannot exceed 72 bytes"):
        hash_password(invalid_73_byte_pw)

