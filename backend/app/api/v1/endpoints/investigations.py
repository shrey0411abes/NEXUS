"""
FastAPI endpoint for natural-language business investigation — tenant-isolated.

POST /api/v1/investigations

Flow:
  1. Validate InvestigationRequest schema.
  2. Extract authenticated tenant context from JWT (never from payload).
  3. Resolve InvestigationService with configured provider and Unit of Work.
  4. Delegate to InvestigationService with verified tenant context.
  5. Return validated InvestigationResponse.

The AI pipeline receives ONLY facts grounded in the authenticated tenant's data.
Cross-tenant contamination is structurally impossible in this flow.
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_business, get_current_user, get_investigation_service
from app.core.rate_limiter import rate_limit_investigations
from app.services.investigation_service import InvestigationService
from models.business import Business
from models.user import User
from ai_schemas.request import InvestigationRequest
from ai_schemas.response import InvestigationResponse
from schemas.investigation import InvestigationAuditSummary, InvestigationAuditDetail
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
        "Submit a natural-language question about your business. "
        "Receives a structured AI interpretation grounded in verified NEXUS analytics "
        "for the authenticated tenant. "
        "The LLM explains deterministic business facts — it does not fabricate them."
    ),
    dependencies=[Depends(rate_limit_investigations)],
)
async def investigate_business(
    payload: InvestigationRequest,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(get_current_user),
    service: InvestigationService = Depends(get_investigation_service),
) -> InvestigationResponse:
    """Natural-language business investigation endpoint — tenant-bound to authenticated user."""
    # Run investigation pipeline with verified tenant context
    # business_id from payload is intentionally NOT used — only the authenticated tenant's data
    try:
        return await service.investigate(
            business=current_business,
            question=payload.question,
            days=payload.days,
            user=current_user,
        )

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

    except ValueError as exc:
        logger.warning("Investigation input validation error: %s", str(exc))
        raise HTTPException(status_code=422, detail=str(exc))

    except Exception as exc:
        logger.exception("Unexpected error in investigation endpoint: %s", type(exc).__name__)
        raise HTTPException(status_code=500, detail="An unexpected server error occurred.")


@router.get(
    "",
    response_model=List[InvestigationAuditSummary],
    summary="List Investigation Audit History",
    description=(
        "Retrieve tenant-scoped investigation audit history in reverse chronological order. "
        "Results are strictly bounded to the authenticated business tenant."
    ),
)
def list_investigations(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum number of investigation records to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset index"),
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(get_current_user),
    service: InvestigationService = Depends(get_investigation_service),
) -> List[InvestigationAuditSummary]:
    """Retrieve investigation audit history for the authenticated tenant."""
    return service.get_investigations(
        business_id=current_business.id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{investigation_id}",
    response_model=InvestigationAuditDetail,
    summary="Get Investigation Audit Detail",
    description=(
        "Retrieve full audit detail for an investigation belonging strictly to the authenticated tenant. "
        "Returns 404 if the record does not exist or belongs to another tenant."
    ),
)
def get_investigation_detail(
    investigation_id: int,
    current_business: Business = Depends(get_current_active_business),
    current_user: User = Depends(get_current_user),
    service: InvestigationService = Depends(get_investigation_service),
) -> InvestigationAuditDetail:
    """Retrieve a specific investigation audit record by ID for the authenticated tenant."""
    investigation = service.get_investigation_by_id(
        business_id=current_business.id,
        investigation_id=investigation_id,
    )
    if investigation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation with ID {investigation_id} not found",
        )
    return investigation


