"""
Tests for InvestigationService formalization (Milestone 3 Slice 1).

Verifies:
1. Direct InvestigationService execution with Unit of Work.
2. Router delegation to InvestigationService via get_investigation_service dependency.
3. Deterministic-first pipeline ordering (verified DB facts grounded before LLM generation).
4. Multi-tenant isolation at the service level.
5. Missing provider raises MissingConfigurationError (mapped to 503 by router).
6. Legacy run_business_investigation entrypoint adapts one-directionally.
"""
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.services.investigation_service import InvestigationService
from app.api.deps import get_investigation_service
from app.main import app
from unit_of_work import SqlAlchemyUnitOfWork
from models import Business, Product, Inventory, Transaction, TransactionItem
from ai_providers.mock_provider import MockLLMProvider
from ai_schemas.response import InvestigationResponse
from exceptions import MissingConfigurationError


class TestInvestigationService:
    """Focused test suite for InvestigationService formalization."""

    @pytest.mark.asyncio
    async def test_service_direct_execution(self, db_session: Session):
        """InvestigationService executes successfully with UoW and returns an InvestigationResponse."""
        biz = Business(name="Direct Service Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()
        db_session.refresh(biz)

        uow = SqlAlchemyUnitOfWork(db_session)
        provider = MockLLMProvider()
        service = InvestigationService(uow=uow, provider=provider)

        result = await service.investigate(
            business=biz,
            question="What products require restock?",
            days=30,
        )

        assert isinstance(result, InvestigationResponse)
        assert result.confidence in ("HIGH", "MEDIUM", "LOW")
        assert isinstance(result.answer, str)
        assert isinstance(result.supporting_facts, list)

    @pytest.mark.asyncio
    async def test_service_deterministic_first_ordering(self, db_session: Session):
        """
        Deterministic business facts from the database must be gathered and
        grounded in the prompt before the LLM provider is invoked.
        """
        biz = Business(name="Deterministic Grounding Co", industry="Manufacturing")
        db_session.add(biz)
        db_session.flush()

        prod = Product(business_id=biz.id, name="Grounding Bolt", category="Hardware", sku="BOLT-01", unit_price=25.0)
        db_session.add(prod)
        db_session.flush()
        db_session.add(Inventory(product_id=prod.id, quantity=3, reorder_level=10))
        db_session.commit()

        captured_user_prompts = []

        class CapturingProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                captured_user_prompts.append(user_prompt)
                provider = MockLLMProvider()
                return await provider.generate(system_prompt, user_prompt)

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=CapturingProvider())

        result = await service.investigate(
            business=biz,
            question="What are my inventory risks?",
            days=30,
        )

        assert len(captured_user_prompts) == 1
        prompt = captured_user_prompts[0]
        # Verify prompt received deterministic database facts
        assert "Deterministic Grounding Co" in prompt
        assert "Manufacturing" in prompt
        assert "Grounding Bolt" in prompt
        assert "BOLT-01" in prompt
        assert isinstance(result, InvestigationResponse)

    @pytest.mark.asyncio
    async def test_service_tenant_isolation(self, db_session: Session):
        """InvestigationService for Tenant A must never ground facts from Tenant B."""
        biz_a = Business(name="Tenant Alpha Corp", industry="Retail")
        biz_b = Business(name="Tenant Beta Ltd", industry="Services")
        db_session.add_all([biz_a, biz_b])
        db_session.flush()

        prod_b = Product(business_id=biz_b.id, name="Secret Beta Gizmo", category="Secret", sku="SECRET-01", unit_price=500.0)
        db_session.add(prod_b)
        db_session.commit()

        captured_prompts = []

        class CapturingProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                captured_prompts.append(user_prompt)
                provider = MockLLMProvider()
                return await provider.generate(system_prompt, user_prompt)

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=CapturingProvider())

        await service.investigate(
            business=biz_a,
            question="Analyze my products.",
            days=30,
        )

        assert len(captured_prompts) == 1
        prompt_a = captured_prompts[0]
        assert "Tenant Alpha Corp" in prompt_a
        assert "Secret Beta Gizmo" not in prompt_a
        assert "SECRET-01" not in prompt_a

    @pytest.mark.asyncio
    async def test_service_missing_provider_raises_configuration_error(self, db_session: Session):
        """InvestigationService without a configured provider raises MissingConfigurationError."""
        biz = Business(name="No Provider Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=None)

        with pytest.raises(MissingConfigurationError) as exc_info:
            await service.investigate(business=biz, question="Any questions?")

        assert "not configured" in str(exc_info.value).lower()

    def test_router_delegates_to_investigation_service(self, client: TestClient):
        """The FastAPI investigations endpoint delegates to InvestigationService via dependency injection."""
        mock_response = InvestigationResponse(
            question="Delegation question?",
            answer="Delegated response from service mock",
            confidence="HIGH",
            key_findings=["Service boundary verified"],
            recommendations=["Keep service decoupled"],
            supporting_facts=["Deterministic fact 1"],
            limitations=[],
        )

        mock_service = AsyncMock(spec=InvestigationService)
        mock_service.investigate.return_value = mock_response

        app.dependency_overrides[get_investigation_service] = lambda: mock_service
        try:
            resp = client.post("/api/v1/investigations", json={
                "business_id": 999,  # Should be ignored; auth tenant passed to service
                "question": "Delegation question?",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["answer"] == "Delegated response from service mock"
            assert mock_service.investigate.called
            # Verify the service was called with authenticated business (not business_id=999)
            call_kwargs = mock_service.investigate.call_args.kwargs
            called_business = call_kwargs.get("business")
            assert called_business.id != 999
        finally:
            del app.dependency_overrides[get_investigation_service]

    @pytest.mark.asyncio
    async def test_legacy_run_business_investigation_adapter(self, db_session: Session):
        """Legacy run_business_investigation adapts one-directionally to InvestigationService."""
        from investigation_service import run_business_investigation

        biz = Business(name="Legacy Adapter Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        provider = MockLLMProvider()
        result = await run_business_investigation(
            db=db_session,
            provider=provider,
            business_id=biz.id,
            business_name=biz.name,
            business_industry=biz.industry,
            question="Legacy pipeline test question?",
            days=30,
        )

        assert isinstance(result, InvestigationResponse)
        assert result.confidence in ("HIGH", "MEDIUM", "LOW")
