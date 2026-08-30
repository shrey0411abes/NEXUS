"""
Phase 2 tests: providers, schemas, context builder, and client.
"""
import json
import pytest
from pydantic import ValidationError


# ---------------------------------------------------------------------------
# Schema Tests
# ---------------------------------------------------------------------------

class TestInvestigationRequestSchema:
    def test_valid_request(self):
        from ai_schemas.request import InvestigationRequest
        req = InvestigationRequest(business_id=1, question="What should I reorder?")
        assert req.business_id == 1
        assert req.question == "What should I reorder?"
        assert req.days == 30

    def test_question_is_stripped(self):
        from ai_schemas.request import InvestigationRequest
        req = InvestigationRequest(business_id=1, question="  What is my revenue?  ")
        assert req.question == "What is my revenue?"

    def test_empty_question_rejected(self):
        from ai_schemas.request import InvestigationRequest
        with pytest.raises(ValidationError):
            InvestigationRequest(business_id=1, question="")

    def test_whitespace_only_question_rejected(self):
        from ai_schemas.request import InvestigationRequest
        with pytest.raises(ValidationError):
            InvestigationRequest(business_id=1, question="   ")

    def test_invalid_business_id_zero(self):
        from ai_schemas.request import InvestigationRequest
        with pytest.raises(ValidationError):
            InvestigationRequest(business_id=0, question="Valid question")

    def test_invalid_business_id_negative(self):
        from ai_schemas.request import InvestigationRequest
        with pytest.raises(ValidationError):
            InvestigationRequest(business_id=-5, question="Valid question")

    def test_question_too_short_rejected(self):
        from ai_schemas.request import InvestigationRequest
        with pytest.raises(ValidationError):
            InvestigationRequest(business_id=1, question="Hi")

    def test_custom_days_window(self):
        from ai_schemas.request import InvestigationRequest
        req = InvestigationRequest(business_id=1, question="Revenue question?", days=14)
        assert req.days == 14


class TestInvestigationResponseSchema:
    def test_valid_response(self):
        from ai_schemas.response import InvestigationResponse
        resp = InvestigationResponse(
            question="What should I reorder?",
            answer="Based on the data, reorder SKU-001.",
            key_findings=["Low stock on 2 items"],
            recommendations=["Reorder SKU-001 urgently"],
            supporting_facts=["Current qty: 5, velocity: 3 units/day, 1.7 days remaining"],
            confidence="HIGH",
            limitations=[]
        )
        assert resp.confidence == "HIGH"

    def test_invalid_confidence_rejected(self):
        from ai_schemas.response import InvestigationResponse
        with pytest.raises(ValidationError):
            InvestigationResponse(
                question="q", answer="a", key_findings=[],
                recommendations=[], supporting_facts=[],
                confidence="VERY_HIGH", limitations=[]
            )

    def test_all_confidence_values_valid(self):
        from ai_schemas.response import InvestigationResponse
        for level in ["HIGH", "MEDIUM", "LOW"]:
            resp = InvestigationResponse(
                question="q", answer="a", key_findings=[], recommendations=[],
                supporting_facts=[], confidence=level, limitations=[]
            )
            assert resp.confidence == level


# ---------------------------------------------------------------------------
# Mock Provider Tests
# ---------------------------------------------------------------------------

class TestMockProvider:
    @pytest.mark.asyncio
    async def test_mock_provider_returns_valid_json(self):
        from ai_providers.mock_provider import MockLLMProvider
        provider = MockLLMProvider()
        result = await provider.generate(
            system_prompt="System instructions",
            user_prompt=(
                "### VERIFIED EXECUTIVE KPIS\n"
                "Total Revenue: $5,000.00\n"
                "Total Completed Transactions: 20\n"
                "Low Stock Alerts: 1\n"
                "Out of Stock SKUs: 0\n"
                "--- USER INVESTIGATION QUESTION ---\n"
                "What should I reorder this week?\n\nAnalyze the verified business context."
            )
        )
        data = json.loads(result)
        assert "answer" in data
        assert "confidence" in data
        assert data["confidence"] in ("HIGH", "MEDIUM", "LOW")

    @pytest.mark.asyncio
    async def test_mock_provider_extracts_revenue_from_context(self):
        from ai_providers.mock_provider import MockLLMProvider
        provider = MockLLMProvider()
        result = await provider.generate(
            system_prompt="Instructions",
            user_prompt=(
                "### VERIFIED EXECUTIVE KPIS\n"
                "Total Revenue: $12,345.67\n"
                "Total Completed Transactions: 42\n"
                "Low Stock Alerts: 3\n"
                "Out of Stock SKUs: 1\n"
                "--- USER INVESTIGATION QUESTION ---\n"
                "What are my main concerns?\n\nAnalyze the verified business context."
            )
        )
        data = json.loads(result)
        assert "12,345.67" in data["answer"]

    @pytest.mark.asyncio
    async def test_mock_provider_no_kpi_returns_low_confidence(self):
        from ai_providers.mock_provider import MockLLMProvider
        provider = MockLLMProvider()
        result = await provider.generate(
            system_prompt="Instructions",
            user_prompt="No KPI data\n--- USER INVESTIGATION QUESTION ---\nAny concerns?\n\nAnalyze."
        )
        data = json.loads(result)
        assert data["confidence"] == "LOW"

    def test_mock_provider_implements_protocol(self):
        from ai_providers.mock_provider import MockLLMProvider
        from ai_providers.base import LLMProvider
        provider = MockLLMProvider()
        assert isinstance(provider, LLMProvider)


# ---------------------------------------------------------------------------
# Client Tests
# ---------------------------------------------------------------------------

class TestAIClient:
    @pytest.mark.asyncio
    async def test_invoke_investigation_with_mock_provider(self):
        from ai_providers.mock_provider import MockLLMProvider
        from client import invoke_investigation
        provider = MockLLMProvider()
        result = await invoke_investigation(
            provider=provider,
            system_prompt="System",
            user_prompt=(
                "### VERIFIED EXECUTIVE KPIS\n"
                "Total Revenue: $9,000.00\n"
                "Total Completed Transactions: 30\n"
                "Low Stock Alerts: 2\n"
                "Out of Stock SKUs: 0\n"
                "--- USER INVESTIGATION QUESTION ---\n"
                "What are my biggest concerns?\n\nAnalyze the verified business context."
            )
        )
        from ai_schemas.response import InvestigationResponse
        assert isinstance(result, InvestigationResponse)
        assert result.confidence in ("HIGH", "MEDIUM", "LOW")

    @pytest.mark.asyncio
    async def test_invoke_investigation_raises_on_malformed_json(self):
        from client import invoke_investigation
        from exceptions import MalformedLLMOutputError

        class BrokenProvider:
            async def generate(self, system_prompt, user_prompt):
                return "Not JSON at all ¯\\_(ツ)_/¯"

        with pytest.raises(MalformedLLMOutputError):
            await invoke_investigation(
                provider=BrokenProvider(),
                system_prompt="sys",
                user_prompt="user",
            )

    @pytest.mark.asyncio
    async def test_invoke_investigation_raises_on_wrong_schema(self):
        from client import invoke_investigation
        from exceptions import MalformedLLMOutputError

        class BadSchemaProvider:
            async def generate(self, system_prompt, user_prompt):
                return json.dumps({"answer": "ok"})  # missing required fields

        with pytest.raises(MalformedLLMOutputError):
            await invoke_investigation(
                provider=BadSchemaProvider(),
                system_prompt="sys",
                user_prompt="user",
            )

    def test_create_provider_mock(self):
        from client import create_provider
        from ai_providers.mock_provider import MockLLMProvider
        provider = create_provider("mock")
        assert isinstance(provider, MockLLMProvider)

    def test_create_provider_unknown_raises(self):
        from client import create_provider
        from exceptions import MissingConfigurationError
        with pytest.raises(MissingConfigurationError):
            create_provider("unknown_provider_xyz")

    def test_create_provider_gemini_without_key_raises(self):
        from client import create_provider
        from exceptions import MissingConfigurationError
        with pytest.raises(MissingConfigurationError):
            create_provider("gemini", api_key=None)

    @pytest.mark.asyncio
    async def test_invoke_strips_markdown_fences(self):
        from client import invoke_investigation

        class FencedProvider:
            async def generate(self, system_prompt, user_prompt):
                return (
                    "```json\n"
                    '{"question":"q","answer":"a","key_findings":[],'
                    '"recommendations":[],"supporting_facts":[],'
                    '"confidence":"LOW","limitations":[]}\n'
                    "```"
                )

        result = await invoke_investigation(
            provider=FencedProvider(), system_prompt="s", user_prompt="u"
        )
        assert result.confidence == "LOW"


# ---------------------------------------------------------------------------
# Context Builder Tests
# ---------------------------------------------------------------------------

class TestBusinessContextBuilder:
    def test_context_contains_kpi_facts(self):
        from ai_context.business_context import build_business_context_prompt
        from analytics_models import BusinessKPIs

        kpis = BusinessKPIs(
            business_id=1,
            observation_period_days=30,
            total_revenue=50000.0,
            total_transactions=100,
            total_units_sold=300,
            average_transaction_value=500.0,
            active_products_count=10,
            low_stock_products_count=2,
            out_of_stock_products_count=1,
        )
        prompts = build_business_context_prompt(
            business_name="Test Corp",
            business_industry="Retail",
            kpis=kpis,
            risk_indicators=[],
            trends=[],
            recommendations=[],
            question="What is my revenue?",
            days=30,
        )
        assert "50,000.00" in prompts["user_prompt"]
        assert "100" in prompts["user_prompt"]
        assert "system_prompt" in prompts
        assert "user_prompt" in prompts

    def test_context_handles_no_kpis_safely(self):
        from ai_context.business_context import build_business_context_prompt
        prompts = build_business_context_prompt(
            business_name="Empty Co",
            business_industry="Services",
            kpis=None,
            risk_indicators=[],
            trends=[],
            recommendations=[],
            question="How are sales?",
            days=30,
        )
        assert "No KPI data available" in prompts["user_prompt"]

    def test_system_prompt_contains_anti_hallucination_contract(self):
        from ai_context.business_context import build_business_context_prompt
        prompts = build_business_context_prompt(
            business_name="Biz",
            business_industry="Retail",
            kpis=None,
            risk_indicators=[],
            trends=[],
            recommendations=[],
            question="Any issues?",
        )
        sp = prompts["system_prompt"]
        assert "CRITICAL CONSTRAINTS" in sp
        assert "DO NOT invent" in sp
