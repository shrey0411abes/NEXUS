"""Core configuration and settings for NEXUS Backend."""
import os
import sys
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure data-layer, recommendation-engine, and ai-llm-integration directories are available in sys.path
root_nexus_dir = Path(__file__).resolve().parent.parent.parent.parent
data_layer_dir = root_nexus_dir / "data-layer"
rec_engine_dir = root_nexus_dir / "recommendation-engine"
ai_llm_dir = root_nexus_dir / "ai-llm-integration"

for d in [data_layer_dir, rec_engine_dir, ai_llm_dir]:
    if d.exists() and str(d) not in sys.path:
        sys.path.insert(0, str(d))


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    PROJECT_NAME: str = "NEXUS - AI Business Operating System"
    VERSION: str = "0.2.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    # Persistence Configuration
    DATABASE_URL: str = "sqlite:///./nexus.db"

    # AI / LLM Configuration
    LLM_PROVIDER: str = "mock"  # "mock" or "gemini"
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_API_KEY: Union[str, None] = None
    LLM_TIMEOUT_SECONDS: float = 30.0


    # CORS Configuration
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
