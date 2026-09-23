"""Pydantic schemas for User and Authentication domain."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserRole(str, Enum):
    """Supported user authorization roles within a business tenant."""
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"


class UserBase(BaseModel):
    """Base schema for user identity attributes."""
    email: str = Field(..., max_length=255, description="Unique operator email address")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if not normalized or "@" not in normalized:
                raise ValueError("Invalid email format.")
            return normalized
        return v


class UserCreate(UserBase):
    """Payload for creating a new user within a tenant."""
    password: str = Field(..., min_length=8, description="Plaintext initial password (min 8 chars)")
    role: UserRole = Field(default=UserRole.OWNER, description="Assigned role in tenant")


class UserLogin(UserBase):
    """Payload for operator login."""
    password: str = Field(..., min_length=1, description="Operator password")


class RegisterRequest(BaseModel):
    """Atomic business registration payload."""
    business_name: str = Field(..., min_length=1, max_length=255, description="Name of the business entity")
    business_industry: str = Field(..., min_length=1, max_length=100, description="Industry sector (e.g. Retail, Grocery)")
    email: str = Field(..., max_length=255, description="Owner email address")
    password: str = Field(..., min_length=8, description="Owner password (min 8 chars)")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        if isinstance(v, str):
            normalized = v.strip().lower()
            if not normalized or "@" not in normalized:
                raise ValueError("Invalid email format.")
            return normalized
        return v


class UserResponse(UserBase):
    """Safe public representation of user identity (password hash excluded)."""
    id: int
    business_id: int
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """JWT authentication response payload."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    business_name: str


class AuthMeResponse(BaseModel):
    """Detailed profile response for the currently authenticated user."""
    user: UserResponse
    business_id: int
    business_name: str
    business_industry: str
