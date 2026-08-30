"""
AI LLM Client — provider factory and structured response validator.
"""
import json
import logging
from typing import Optional
from pydantic import ValidationError
from exceptions import (
    MissingConfigurationError,
    LLMProviderError,
    MalformedLLMOutputError,
)
from ai_schemas.response import InvestigationResponse

logger = logging.getLogger(__name__)


def create_provider(
    provider_name: str,
    api_key: Optional[str] = None,
    model: str = "gemini-1.5-flash",
    timeout_seconds: float = 30.0,
):
    """
    Factory: instantiate and return the configured LLM provider.

    Args:
        provider_name: "mock" or "gemini"
        api_key: Required only for real providers.
        model: Model identifier string.
        timeout_seconds: Provider call timeout.

    Returns:
        An object implementing LLMProvider protocol.

    Raises:
        MissingConfigurationError: Unknown provider or missing API key.
    """
    if provider_name == "mock":
        from ai_providers.mock_provider import MockLLMProvider
        return MockLLMProvider()

    if provider_name == "gemini":
        from ai_providers.gemini_provider import GeminiProvider
        return GeminiProvider(api_key=api_key or "", model=model, timeout_seconds=timeout_seconds)

    raise MissingConfigurationError(
        f"Unknown LLM provider: '{provider_name}'. Supported: 'mock', 'gemini'."
    )


async def invoke_investigation(
    provider,
    system_prompt: str,
    user_prompt: str,
) -> InvestigationResponse:
    """
    Invoke the provider and validate the structured response.

    Args:
        provider: LLMProvider-compliant instance.
        system_prompt: Anti-hallucination instructions for the provider.
        user_prompt: Business context + user question.

    Returns:
        Validated InvestigationResponse Pydantic model.

    Raises:
        MalformedLLMOutputError: If provider returns unparseable or invalid output.
        LLMProviderError: Re-raised from provider on API failure.
    """
    raw_text = await provider.generate(system_prompt=system_prompt, user_prompt=user_prompt)

    # Strip common markdown code fences that some models wrap JSON in
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        ).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error("LLM returned non-JSON output (first 200 chars): %s", cleaned[:200])
        raise MalformedLLMOutputError(
            "LLM provider returned output that could not be parsed as JSON."
        ) from exc

    try:
        return InvestigationResponse.model_validate(data)
    except ValidationError as exc:
        logger.error("LLM JSON failed InvestigationResponse validation: %s", str(exc)[:300])
        raise MalformedLLMOutputError(
            "LLM provider returned JSON that does not match the expected investigation schema."
        ) from exc
