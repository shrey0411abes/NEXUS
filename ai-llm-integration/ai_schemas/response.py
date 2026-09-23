"""Response schema for structured business investigation outputs."""
import unicodedata
from typing import List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


def sanitize_text(text: str) -> str:
    """
    Strips Unicode control characters (category Cc) except allowed whitespace
    (\t, \n, \r), and strips leading/trailing whitespace.
    Preserves all valid multilingual Unicode text (accented Latin, CJK, Cyrillic,
    Devanagari, Greek, Hebrew, emoji, currency symbols, punctuation, etc.).
    """
    cleaned = "".join(
        char for char in text
        if unicodedata.category(char) != "Cc" or char in ("\t", "\n", "\r")
    )
    return cleaned.strip()


class InvestigationResponse(BaseModel):
    """Structured, verified business investigation answer."""
    question: str = Field(default="", description="Original question investigated")
    answer: str = Field(..., description="Concise, plain-language business explanation")
    key_findings: List[str] = Field(default_factory=list, description="Core analytical findings extracted from facts")
    recommendations: List[str] = Field(default_factory=list, description="Actionable business next-steps")
    supporting_facts: List[str] = Field(default_factory=list, description="Explicit verified metrics used as reasoning evidence")
    confidence: Literal["HIGH", "MEDIUM", "LOW"] = Field(..., description="Deterministic confidence level based on data completeness")
    limitations: List[str] = Field(default_factory=list, description="Data boundaries or caveats to the investigation")

    model_config = ConfigDict(extra="ignore")

    @field_validator("question", mode="before")
    @classmethod
    def validate_and_sanitize_question(cls, v: object) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            return sanitize_text(str(v))
        return sanitize_text(v)

    @field_validator("answer", mode="before")
    @classmethod
    def validate_and_sanitize_answer(cls, v: object) -> str:
        if v is None or not isinstance(v, str):
            raise ValueError("Answer must be a non-empty string.")
        sanitized = sanitize_text(v)
        if not sanitized:
            raise ValueError("Answer cannot be empty or whitespace-only.")
        return sanitized

    @field_validator("key_findings", "recommendations", "supporting_facts", "limitations", mode="before")
    @classmethod
    def validate_and_sanitize_string_list(cls, v: object) -> List[str]:
        if v is None:
            return []
        if not isinstance(v, list):
            raise ValueError("Expected a list of strings.")
        sanitized_list: List[str] = []
        for item in v:
            if not isinstance(item, str):
                raise ValueError("List items must be strings.")
            sanitized = sanitize_text(item)
            if sanitized:
                sanitized_list.append(sanitized)
        return sanitized_list
