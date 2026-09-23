"""Request schema for business investigation queries."""
import unicodedata
from pydantic import BaseModel, ConfigDict, Field, field_validator


class InvestigationRequest(BaseModel):
    """Natural-language business investigation request."""
    business_id: int = Field(..., gt=0, description="Target business identifier (must be positive integer)")
    question: str = Field(..., min_length=3, max_length=2000, description="Natural-language business investigation question")
    days: int = Field(default=30, ge=1, le=365, description="Observation window in days for metric context")

    @field_validator("question", mode="before")
    @classmethod
    def strip_and_validate_question(cls, v: str) -> str:
        if v is None:
            raise ValueError("Question cannot be None")
        if not isinstance(v, str):
            raise ValueError("Question must be a string")
        stripped = v.strip()
        if len(stripped) < 3:
            raise ValueError("Question must contain at least 3 non-whitespace characters")
        if len(stripped) > 2000:
            raise ValueError("Question must not exceed 2000 characters")

        for char in stripped:
            if unicodedata.category(char) == "Cc" and char not in ("\t", "\n", "\r"):
                raise ValueError("Question contains disallowed control characters")

        return stripped

    model_config = ConfigDict(extra="forbid")
