"""Custom exceptions for the AI/LLM integration layer."""


class AIIntegrationError(Exception):
    """Base exception for all AI/LLM integration errors."""
    pass


class MissingConfigurationError(AIIntegrationError):
    """Raised when required LLM configuration or API keys are absent."""
    pass


class LLMProviderError(AIIntegrationError):
    """Raised when an external LLM provider fails during invocation."""
    pass


class LLMTimeoutError(LLMProviderError):
    """Raised when the LLM provider call times out."""
    pass


class MalformedLLMOutputError(AIIntegrationError):
    """Raised when LLM output cannot be validated into the expected Pydantic schema."""
    pass
