"""
Legacy Business Investigation Entrypoint.

Preserved for backwards compatibility with external scripts or tests.
Delegates one-directionally to backend.app.services.InvestigationService.
"""
from sqlalchemy.orm import Session
from ai_providers.base import LLMProvider
from ai_schemas.response import InvestigationResponse


async def run_business_investigation(
    db: Session,
    provider: LLMProvider,
    business_id: int,
    business_name: str,
    business_industry: str,
    question: str,
    days: int = 30,
) -> InvestigationResponse:
    """
    Execute the full investigation pipeline for a business question.
    Adapts legacy function signature to the formalized InvestigationService.
    """
    from app.services.investigation_service import InvestigationService
    from unit_of_work import SqlAlchemyUnitOfWork

    uow = SqlAlchemyUnitOfWork(db)
    service = InvestigationService(uow=uow, provider=provider)
    return await service.investigate(
        business_id=business_id,
        business_name=business_name,
        business_industry=business_industry,
        question=question,
        days=days,
        provider=provider,
    )

