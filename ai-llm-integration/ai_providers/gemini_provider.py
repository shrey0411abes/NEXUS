"""
Google Gemini LLM Provider using the modern official google-genai SDK.

Requires:
  LLM_PROVIDER=gemini
  LLM_API_KEY=<your-key>
  LLM_MODEL=gemini-2.5-flash  (or gemini-1.5-flash, gemini-2.0-flash, etc.)

Install:
  pip install google-genai

All provider-specific SDK code is isolated in this file.
"""
import asyncio
import logging
from exceptions import MissingConfigurationError, LLMProviderError, LLMTimeoutError

logger = logging.getLogger(__name__)


class GeminiProvider:
    """Google Gemini provider implementation using official google-genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", timeout_seconds: float = 30.0):
        if not api_key or not api_key.strip():
            raise MissingConfigurationError(
                "LLM_API_KEY is required for the Gemini provider. "
                "Set LLM_PROVIDER=mock to run without credentials."
            )
        self._model_name = model
        self._timeout = timeout_seconds
        self._api_key = api_key

        try:
            from google import genai
            self._client = genai.Client(api_key=api_key)
        except ImportError as exc:
            raise MissingConfigurationError(
                "google-genai package is not installed. "
                "Run: pip install google-genai"
            ) from exc

    async def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Call Gemini API asynchronously with structured JSON configuration."""
        from google.genai import types

        try:
            loop = asyncio.get_running_loop()
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                temperature=0.2,
            )
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self._client.models.generate_content(
                        model=self._model_name,
                        contents=user_prompt,
                        config=config,
                    )
                ),
                timeout=self._timeout
            )
            return response.text or "{}"
        except TimeoutError as exc:
            logger.error("Gemini API timed out after %ss", self._timeout)
            raise LLMTimeoutError(f"Gemini API timed out after {self._timeout}s") from exc
        except Exception as exc:
            logger.error("Gemini API error: %s", type(exc).__name__)
            raise LLMProviderError(f"Gemini API call failed: {type(exc).__name__}") from exc
