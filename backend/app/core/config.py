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
default_db_path = (root_nexus_dir / "nexus.db").resolve()
default_db_url = f"sqlite:///{default_db_path.as_posix()}"

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
    DATABASE_URL: str = default_db_url

    # AI / LLM Configuration
    LLM_PROVIDER: str = "mock"  # "mock" or "gemini"
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_API_KEY: Union[str, None] = None
    LLM_TIMEOUT_SECONDS: float = 30.0


    # Security & Authentication Configuration
    JWT_SECRET_KEY: str = "nexus-insecure-dev-secret-key-change-in-production-32chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Request Hardening Configuration
    MAX_REQUEST_BODY_SIZE: int = 2 * 1024 * 1024  # 2 MB (2,097,152 bytes)

    # Rate Limiting Configuration
    RATE_LIMIT_LOGIN_MAX_REQUESTS: int = 5
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: int = 60
    RATE_LIMIT_INVESTIGATION_MAX_REQUESTS: int = 10
    RATE_LIMIT_INVESTIGATION_WINDOW_SECONDS: int = 60

    # CORS Configuration
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development").lower()
        insecure_defaults = {
            "nexus-insecure-dev-secret-key-change-in-production-32chars",
            "secret",
            "changeme",
            "password",
            "default",
            "12345678901234567890123456789012",
        }
        if env == "production":
            if not v or v in insecure_defaults:
                raise ValueError("Insecure or default JWT_SECRET_KEY is prohibited in production environment.")
            if len(v) < 32:
                raise ValueError("JWT_SECRET_KEY must have at least 32 characters in production.")
        return v

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
