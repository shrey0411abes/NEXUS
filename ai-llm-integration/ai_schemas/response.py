"""Response schema for structured business investigation outputs."""
from typing import List, Literal
from pydantic import BaseModel, ConfigDict, Field


class InvestigationResponse(BaseModel):
    """Structured, verified business investigation answer."""
    question: str = Field(..., description="Original question investigated")
    answer: str = Field(..., description="Concise, plain-language business explanation")
    key_findings: List[str] = Field(default_factory=list, description="Core analytical findings extracted from facts")
    recommendations: List[str] = Field(default_factory=list, description="Actionable business next-steps")
    supporting_facts: List[str] = Field(default_factory=list, description="Explicit verified metrics used as reasoning evidence")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(..., description="Deterministic confidence level based on data completeness")
    limitations: List[str] = Field(default_factory=list, description="Data boundaries or caveats to the investigation")

    model_config = ConfigDict(extra="ignore")
