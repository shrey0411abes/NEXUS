"""NEXUS AI/LLM Integration Package."""
from client import create_provider, invoke_investigation
from exceptions import (
    AIIntegrationError,
    MissingConfigurationError,
    LLMProviderError,
    LLMTimeoutError,
    MalformedLLMOutputError,
)
from ai_schemas.request import InvestigationRequest
from ai_schemas.response import InvestigationResponse

__version__ = "0.1.0"

__all__ = [
    "create_provider",
    "invoke_investigation",
    "AIIntegrationError",
    "MissingConfigurationError",
    "LLMProviderError",
    "LLMTimeoutError",
    "MalformedLLMOutputError",
    "InvestigationRequest",
    "InvestigationResponse",
]
