"""Pydantic schemas for RiskAction audit and mutation entities."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class RiskState(str, Enum):
    """Supported operational risk lifecycle states."""
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class RiskActionCreate(BaseModel):
    """Payload schema for recording an operational risk action transition."""
    risk_fingerprint: str = Field(..., min_length=1, max_length=64, description="Deterministic risk fingerprint")
    product_id: Optional[int] = Field(None, description="Affected product ID if product-specific")
    risk_category: str = Field(..., min_length=1, max_length=50, description="Risk classification category")
    state: RiskState = Field(..., description="Target operational state transition")
    action_note: Optional[str] = Field(None, max_length=1000, description="Operational rationale or mitigation note")
    metrics_snapshot: Dict[str, Any] = Field(default_factory=dict, description="Point-in-time metrics snapshot")


class RiskActionResponse(BaseModel):
    """Authoritative audit record of a recorded risk action transition."""
    id: int = Field(..., description="Unique action audit entry ID")
    business_id: int = Field(..., description="Target business tenant ID")
    user_id: Optional[int] = Field(None, description="Actor user ID (NULL for system transitions)")
    user_email: Optional[str] = Field(None, description="Actor email address if available")
    product_id: Optional[int] = Field(None, description="Affected product ID if product-specific")
    risk_fingerprint: str = Field(..., description="Deterministic risk fingerprint")
    risk_category: str = Field(..., description="Risk classification category")
    state: str = Field(..., description="Current operational state")
    action_note: Optional[str] = Field(None, description="Operational rationale or mitigation note")
    metrics_snapshot: Dict[str, Any] = Field(default_factory=dict, description="Point-in-time metrics snapshot")
    created_at: datetime = Field(..., description="Timestamp when action was recorded")

    model_config = ConfigDict(from_attributes=True)
