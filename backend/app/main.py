"""NEXUS FastAPI Application Entrypoint."""
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Initialize database tables
    init_db()

    # Initialize LLM provider and store in app.state
    # Provider name comes from environment — default is 'mock' (no API key needed)
    try:
        from client import create_provider
        provider = create_provider(
            provider_name=settings.LLM_PROVIDER,
            api_key=settings.LLM_API_KEY,
            model=settings.LLM_MODEL,
            timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
        )
        app.state.llm_provider = provider
        app.state.llm_provider_name = settings.LLM_PROVIDER
        logger.info("LLM provider initialized: provider=%s model=%s", settings.LLM_PROVIDER, settings.LLM_MODEL)
    except Exception as exc:
        # Non-fatal: investigation endpoints will return 503 if provider unavailable,
        # but all other API endpoints remain operational.
        logger.warning(
            "LLM provider could not be initialized (provider=%s, %s): %s",
            settings.LLM_PROVIDER, type(exc).__name__, str(exc)
        )
        app.state.llm_provider = None
        app.state.llm_provider_name = "unavailable"

    yield

    # Cleanup (no persistent resources to release in current phase)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# CORS middleware configuration
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Safely catch unhandled internal exceptions without leaking stack traces or internal paths."""
    from fastapi.responses import JSONResponse
    logger.exception("Unhandled server error processing request %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."},
    )


@app.get("/health", tags=["Health"], response_model=Dict[str, Any])
async def health_check(request: Request) -> Dict[str, Any]:
    """Health check endpoint to verify backend service operational status."""
    provider_name = getattr(request.app.state, "llm_provider_name", "unknown")
    provider_ready = getattr(request.app.state, "llm_provider", None) is not None
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "ai_provider": provider_name,
        "ai_provider_ready": provider_ready,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
