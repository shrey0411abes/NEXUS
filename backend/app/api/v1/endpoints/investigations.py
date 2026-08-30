"""
FastAPI endpoint for natural-language business investigation.

POST /api/v1/investigations

Flow:
  1. Validate InvestigationRequest schema.
  2. Verify business exists (404 if not).
  3. Get the configured LLM provider (from app state).
  4. Delegate to the investigation service.
  5. Return validated InvestigationResponse.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
from repositories.business_repository import BusinessRepository
from ai_schemas.request import InvestigationRequest
from ai_schemas.response import InvestigationResponse
from investigation_service import run_business_investigation
from exceptions import (
    MissingConfigurationError,
    LLMProviderError,
    LLMTimeoutError,
    MalformedLLMOutputError,
)

router = APIRouter(prefix="/investigations", tags=["AI Investigation"])
logger = logging.getLogger(__name__)


@router.post(
    "",
    response_model=InvestigationResponse,
    summary="Natural-Language Business Investigation",
    description=(
        "Submit a natural-language question about a business. "
        "Receives a structured AI interpretation grounded in verified NEXUS analytics. "
        "The LLM explains deterministic business facts — it does not fabricate them."
    ),
)
async def investigate_business(
    payload: InvestigationRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> InvestigationResponse:
    """Natural-language business investigation endpoint."""
    # 1. Verify business exists
    business = BusinessRepository(db).get_by_id(business_id=payload.business_id)
    if not business:
        raise HTTPException(
            status_code=404,
            detail=f"Business with id={payload.business_id} not found.",
        )

    # 2. Retrieve provider from app state
    provider = getattr(request.app.state, "llm_provider", None)
    if provider is None:
        logger.error("LLM provider not initialized in app.state")
        raise HTTPException(
            status_code=503,
            detail="AI investigation service is not available. LLM provider is not configured.",
        )

    # 3. Run the investigation pipeline
    try:
        result = await run_business_investigation(
            db=db,
            provider=provider,
            business_id=business.id,
            business_name=business.name,
            business_industry=business.industry,
            question=payload.question,
            days=payload.days,
        )
        return result

    except MissingConfigurationError as exc:
        logger.error("LLM configuration error: %s", str(exc))
        raise HTTPException(status_code=503, detail=str(exc))

    except LLMTimeoutError as exc:
        logger.error("LLM provider timed out: %s", str(exc))
        raise HTTPException(status_code=503, detail="AI provider timed out. Please retry.")

    except LLMProviderError as exc:
        logger.error("LLM provider error: %s", str(exc))
        raise HTTPException(
            status_code=503,
            detail="AI provider is temporarily unavailable. Please retry or use the deterministic analytics.",
        )

    except MalformedLLMOutputError as exc:
        logger.error("Malformed LLM output: %s", str(exc))
        raise HTTPException(
            status_code=502,
            detail="AI provider returned an unexpected response format. Please retry.",
        )

    except Exception as exc:
        logger.exception("Unexpected error in investigation endpoint: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")
