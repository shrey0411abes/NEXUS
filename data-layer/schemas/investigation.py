"""Pydantic schemas for Investigation audit history entities."""
from datetime import datetime
from typing import Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class InvestigationAuditSummary(BaseModel):
    """
    Read-only audit summary of an executed business investigation.

    Data minimization: Exposes only presentation fields needed for history/list.
    Omits internal business_id (already scoped by authenticated tenant)
    and raw user_id.
    """
    id: int = Field(..., description="Unique investigation audit identifier")
    question: str = Field(..., description="Natural language question asked")
    confidence: str = Field(..., description="Calibrated confidence level (HIGH, MEDIUM, LOW)")
    verification_status: str = Field(..., description="Deterministic claim verification outcome")
    provider: str = Field(..., description="AI provider used for investigation")
    execution_duration_ms: float = Field(..., description="Execution duration in milliseconds")
    created_at: datetime = Field(..., description="Timestamp when investigation was executed and recorded")

    model_config = ConfigDict(from_attributes=True)


class InvestigationAuditDetail(InvestigationAuditSummary):
    """
    Read-only detailed audit record of an executed business investigation.

    Exposes summary fields plus the generated answer and verified context snapshot.
    """
    answer: str = Field(..., description="Authoritative generated investigation response answer")
    context_snapshot: Dict[str, Any] = Field(
        default_factory=dict,
        description="Deterministic factual analytics context and verification verdicts",
    )

    model_config = ConfigDict(from_attributes=True)
