"""
LLM Provider abstraction protocol.

All providers must implement this interface. The investigation service
depends only on this protocol — never on a concrete provider class.
"""
from typing import Protocol, runtime_checkable


@runtime_checkable
class LLMProvider(Protocol):
    """
    Provider-agnostic async interface for text generation.

    Constraints:
    - No FastAPI, SQLAlchemy, or recommendation-engine imports allowed here.
    - Must be async to support concurrent investigation requests.
    - Returns raw string (JSON expected) — validation happens in client.py.
    """

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """
        Generate a response given system and user prompts.

        Args:
            system_prompt: Instructions establishing context and constraints.
            user_prompt: The user's investigation query with business context.

        Returns:
            Raw string response from the provider (expected to be JSON).

        Raises:
            LLMProviderError: On provider-side failure.
            LLMTimeoutError: On provider timeout.
            MissingConfigurationError: If provider is not configured.
        """
        ...
