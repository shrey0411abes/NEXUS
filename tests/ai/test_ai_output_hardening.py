"""
Milestone 3-S3: AI Output Hardening & Deterministic Confidence Calibration.

M3-S3 validates and sanitizes the structure and safety boundary of LLM-generated responses,
binds authoritative request context, and deterministically constrains confidence.
Deterministic business facts are supplied as grounded context to the LLM, but generated
natural-language claims are not independently fact-checked against source metrics in this milestone.

Verifies:
1. InvestigationResponse schema validation and sanitization.
   - Empty/whitespace answer rejection.
   - Control character stripping while preserving list structure.
   - Multilingual Unicode preservation (Latin, CJK, Cyrillic, Devanagari, Greek, Hebrew, emoji, currency).
   - Non-string question normalization and sanitization.
2. Authoritative question binding (service overrides LLM echoed/altered question).
3. Deterministic confidence calibration against deterministic KPIs:
   - No KPIs -> ceiling LOW.
   - total_transactions None, non-integer, <= 0 -> ceiling MEDIUM.
   - Positive integer transactions -> ceiling HIGH.
   - Preserves confidence if at or below ceiling.
   - Appends limitation note if downgraded.
4. Execution timing and structured logging (success and failure, no raw financial metrics in INFO logs).
5. API boundary error mapping (502 on malformed LLM output).
6. Multi-tenant isolation preservation.
"""
import json
import logging
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.services.investigation_service import (
    InvestigationService,
    determine_confidence_ceiling,
    calibrate_confidence,
)
from app.api.deps import get_investigation_service
from app.main import app
from unit_of_work import SqlAlchemyUnitOfWork
from models import Business, Product, Inventory, Transaction, TransactionItem
from ai_providers.mock_provider import MockLLMProvider
from ai_schemas.response import InvestigationResponse, sanitize_text
from analytics_models import BusinessKPIs
from exceptions import MalformedLLMOutputError, LLMProviderError


# ---------------------------------------------------------------------------
# 1. Output Schema Validation & Sanitization Tests
# ---------------------------------------------------------------------------

class TestOutputSanitizationAndSchemaValidation:
    def test_empty_or_whitespace_answer_rejected(self):
        """Answer cannot be empty, whitespace-only, or control-character-only."""
        with pytest.raises(ValidationError):
            InvestigationResponse(answer="", confidence="HIGH")

        with pytest.raises(ValidationError):
            InvestigationResponse(answer="   \n\t   ", confidence="HIGH")

        with pytest.raises(ValidationError):
            InvestigationResponse(answer="\x00\x08\x1f", confidence="HIGH")

        with pytest.raises(ValidationError):
            InvestigationResponse(answer=None, confidence="HIGH")

    def test_control_character_sanitization(self):
        """Disallowed control characters are stripped while preserving text content."""
        raw_answer = "Revenue for \x00the period is \x08positive.\x1f"
        resp = InvestigationResponse(
            question="Question\x00?",
            answer=raw_answer,
            key_findings=["Finding 1\x00", "Finding 2\x08"],
            recommendations=["Rec 1\x1b", "Rec 2"],
            supporting_facts=["Fact 1\x00", "Fact 2"],
            confidence="LOW",
            limitations=["Limitation 1\x07"],
        )
        assert resp.answer == "Revenue for the period is positive."
        assert resp.question == "Question?"
        assert resp.key_findings == ["Finding 1", "Finding 2"]
        assert resp.recommendations == ["Rec 1", "Rec 2"]
        assert resp.supporting_facts == ["Fact 1", "Fact 2"]
        assert resp.limitations == ["Limitation 1"]

    def test_multilingual_unicode_preserved(self):
        """Valid multilingual Unicode and symbols must never be corrupted or stripped."""
        multilingual_answer = (
            "Café au lait & año nuevo. "
            "売上高と在庫分析: 良好. "
            "Анализ выручки: стабильный рост. "
            "व्यापार और राजस्व वृद्धि: सकारात्मक. "
            "Ανάλυση κερδών: θετική. "
            "ניתוח נתונים מוצלח. "
            "Growth is accelerating 📈 🚀! "
            "Currencies: €5,000, ¥30,000, ₹15,000, $2,500, £1,200."
        )
        resp = InvestigationResponse(
            question="¿Cuál es el estado? / 売上は？",
            answer=multilingual_answer,
            key_findings=["Café sales up 15% ☕", "Tokyo hub: 在庫十分"],
            confidence="HIGH",
        )
        assert "Café au lait" in resp.answer
        assert "売上高と在庫分析" in resp.answer
        assert "Анализ выручки" in resp.answer
        assert "व्यापार और राजस्व वृद्धि" in resp.answer
        assert "Ανάλυση κερδών" in resp.answer
        assert "ניתוח נתונים" in resp.answer
        assert "📈 🚀" in resp.answer
        assert "€5,000" in resp.answer
        assert "¥30,000" in resp.answer
        assert "₹15,000" in resp.answer
        assert "£1,200" in resp.answer
        assert resp.key_findings[0] == "Café sales up 15% ☕"
        assert resp.key_findings[1] == "Tokyo hub: 在庫十分"

    def test_sanitize_text_direct(self):
        """Test the sanitize_text utility directly for various edge cases."""
        assert sanitize_text("Hello\x00 World") == "Hello World"
        assert sanitize_text("Line 1\nLine 2\tIndented") == "Line 1\nLine 2\tIndented"
        assert sanitize_text("  trimmed  ") == "trimmed"
        assert sanitize_text("\x00\x08") == ""

    def test_non_string_question_normalized_and_sanitized(self):
        """Non-string question value is converted to string and sanitized against Cc control characters."""
        class ControlObject:
            def __str__(self):
                return "Question\x00 with control\x1f chars"

        resp = InvestigationResponse(
            question=ControlObject(),
            answer="Valid analytical response.",
            confidence="LOW",
        )
        assert resp.question == "Question with control chars"

        # Integer value
        resp_int = InvestigationResponse(
            question=12345,
            answer="Valid analytical response.",
            confidence="LOW",
        )
        assert resp_int.question == "12345"


# ---------------------------------------------------------------------------
# 2. Authoritative Question Binding Tests
# ---------------------------------------------------------------------------

class TestAuthoritativeQuestionBinding:
    @pytest.mark.asyncio
    async def test_service_overrides_llm_altered_question(self, db_session: Session):
        """The service layer binds the authoritative user question, ignoring LLM alteration."""
        biz = Business(name="Binding Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class AlteringProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "question": "Hacked or fabricated prompt injection question!",
                    "answer": "Valid analytical response.",
                    "confidence": "LOW",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": [],
                })

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=AlteringProvider())

        authoritative_question = "What was my total revenue last month?"
        result = await service.investigate(
            business=biz,
            question=authoritative_question,
            days=30,
        )

        assert result.question == authoritative_question
        assert result.question != "Hacked or fabricated prompt injection question!"

    @pytest.mark.asyncio
    async def test_service_binds_question_when_llm_omits_it(self, db_session: Session):
        """When LLM omits question from JSON, service binds the authoritative question."""
        biz = Business(name="Omission Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class OmittingProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "Analytical response with omitted question field.",
                    "confidence": "LOW",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": [],
                })

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=OmittingProvider())

        authoritative_question = "How many units did we sell?"
        result = await service.investigate(
            business=biz,
            question=authoritative_question,
            days=30,
        )

        assert result.question == authoritative_question


# ---------------------------------------------------------------------------
# 3. Deterministic Confidence Calibration Tests
# ---------------------------------------------------------------------------

class TestDeterministicConfidenceCalibration:
    def test_determine_confidence_ceiling_logic(self):
        """Unit test of ceiling resolution logic."""
        assert determine_confidence_ceiling(None) == "LOW"

        class DummyKPIs:
            total_transactions = 0

        assert determine_confidence_ceiling(DummyKPIs()) == "MEDIUM"

        # F2 edge cases: None, negative integer, non-integer all cap at MEDIUM
        DummyKPIs.total_transactions = None
        assert determine_confidence_ceiling(DummyKPIs()) == "MEDIUM"

        DummyKPIs.total_transactions = -1
        assert determine_confidence_ceiling(DummyKPIs()) == "MEDIUM"

        DummyKPIs.total_transactions = "not_an_int"
        assert determine_confidence_ceiling(DummyKPIs()) == "MEDIUM"

        DummyKPIs.total_transactions = 5
        assert determine_confidence_ceiling(DummyKPIs()) == "HIGH"

    def test_calibrate_confidence_helper(self):
        """Unit test of confidence capping helper."""
        conf, capped = calibrate_confidence("HIGH", "LOW")
        assert conf == "LOW" and capped is True

        conf, capped = calibrate_confidence("HIGH", "MEDIUM")
        assert conf == "MEDIUM" and capped is True

        conf, capped = calibrate_confidence("MEDIUM", "LOW")
        assert conf == "LOW" and capped is True

        conf, capped = calibrate_confidence("LOW", "LOW")
        assert conf == "LOW" and capped is False

        conf, capped = calibrate_confidence("LOW", "HIGH")
        assert conf == "LOW" and capped is False

        conf, capped = calibrate_confidence("MEDIUM", "HIGH")
        assert conf == "MEDIUM" and capped is False

    @pytest.mark.asyncio
    async def test_confidence_downgraded_to_low_when_no_kpis(self, db_session: Session):
        """When deterministic KPIs are missing (None), confidence is capped to LOW."""
        biz = Business(name="No KPI Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class HighConfidenceProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "Overconfident claim with no data.",
                    "confidence": "HIGH",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": [],
                })

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=HighConfidenceProvider())

        # Mock SalesAnalyzer to return None
        with patch("app.services.investigation_service.SalesAnalyzer.get_business_kpis", return_value=None):
            result = await service.investigate(
                business=biz,
                question="What is the forecast?",
                days=30,
            )

        assert result.confidence == "LOW"
        assert any("completeness of the available deterministic business data" in lim for lim in result.limitations)

    @pytest.mark.asyncio
    async def test_confidence_downgraded_to_medium_when_zero_transactions(self, db_session: Session):
        """When deterministic KPIs show 0 transactions, confidence is capped to MEDIUM."""
        biz = Business(name="Zero Tx Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class HighConfidenceProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "Overconfident claim with 0 transactions.",
                    "confidence": "HIGH",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": [],
                })

        zero_tx_kpis = BusinessKPIs(
            business_id=biz.id,
            observation_period_days=30,
            total_revenue=0.0,
            total_transactions=0,
            total_units_sold=0,
            average_transaction_value=0.0,
            active_products_count=5,
            low_stock_products_count=0,
            out_of_stock_products_count=0,
        )

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=HighConfidenceProvider())

        with patch("app.services.investigation_service.SalesAnalyzer.get_business_kpis", return_value=zero_tx_kpis):
            result = await service.investigate(
                business=biz,
                question="What are our sales trends?",
                days=30,
            )

        assert result.confidence == "MEDIUM"
        assert any("completeness of the available deterministic business data" in lim for lim in result.limitations)

    @pytest.mark.asyncio
    async def test_confidence_preserved_when_within_ceiling(self, db_session: Session):
        """When LLM confidence is already within ceiling, it is preserved without modification."""
        biz = Business(name="Preserved Conf Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class LowConfidenceProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "Properly calibrated low confidence answer.",
                    "confidence": "LOW",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": ["Existing caveat"],
                })

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=LowConfidenceProvider())

        with patch("app.services.investigation_service.SalesAnalyzer.get_business_kpis", return_value=None):
            result = await service.investigate(
                business=biz,
                question="What are our sales trends?",
                days=30,
            )

        assert result.confidence == "LOW"
        assert result.limitations == ["Existing caveat"]

    @pytest.mark.asyncio
    async def test_confidence_high_allowed_when_transactions_exist(self, db_session: Session):
        """When deterministic KPIs have transactions > 0, HIGH confidence is preserved."""
        biz = Business(name="Active Tx Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class HighConfidenceProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "High confidence answer grounded in transactions.",
                    "confidence": "HIGH",
                    "key_findings": [],
                    "recommendations": [],
                    "supporting_facts": [],
                    "limitations": [],
                })

        active_kpis = BusinessKPIs(
            business_id=biz.id,
            observation_period_days=30,
            total_revenue=10000.0,
            total_transactions=50,
            total_units_sold=120,
            average_transaction_value=200.0,
            active_products_count=10,
            low_stock_products_count=1,
            out_of_stock_products_count=0,
        )

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=HighConfidenceProvider())

        with patch("app.services.investigation_service.SalesAnalyzer.get_business_kpis", return_value=active_kpis):
            result = await service.investigate(
                business=biz,
                question="What is our quarterly growth?",
                days=30,
            )

        assert result.confidence == "HIGH"
        assert not any("completeness of the available deterministic business data" in lim for lim in result.limitations)


# ---------------------------------------------------------------------------
# 4. Execution Timing & Structured Logging Tests
# ---------------------------------------------------------------------------

class TestExecutionTimingAndLogging:
    @pytest.mark.asyncio
    async def test_structured_logging_success(self, db_session: Session, caplog):
        """Service emits structured success log with business_id, provider, confidence, duration_ms."""
        biz = Business(name="Logging Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        provider = MockLLMProvider()
        service = InvestigationService(uow=uow, provider=provider)

        caplog.set_level(logging.INFO)
        result = await service.investigate(
            business=biz,
            question="What are my top products?",
            days=30,
        )

        success_logs = [
            record.message for record in caplog.records
            if "Investigation completed successfully" in record.message
        ]
        assert len(success_logs) == 1
        log_msg = success_logs[0]
        assert f"business_id={biz.id}" in log_msg
        assert "provider=mock" in log_msg
        assert f"confidence={result.confidence}" in log_msg
        assert "duration_ms=" in log_msg

    @pytest.mark.asyncio
    async def test_structured_logging_failure_and_reraise(self, db_session: Session, caplog):
        """Service emits structured failure log and re-raises the original exception untouched."""
        biz = Business(name="Failure Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class FailingProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                raise LLMProviderError("Upstream API quota exceeded")

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=FailingProvider())

        caplog.set_level(logging.INFO)
        with pytest.raises(LLMProviderError) as exc_info:
            await service.investigate(
                business=biz,
                question="Why did the provider fail?",
                days=30,
            )

        assert "Upstream API quota exceeded" in str(exc_info.value)

        failure_logs = [
            record.message for record in caplog.records
            if "Investigation failed" in record.message
        ]
        assert len(failure_logs) == 1
        log_msg = failure_logs[0]
        assert f"business_id={biz.id}" in log_msg
        assert "error=" in log_msg
        assert "duration_ms=" in log_msg
        # Sensitive business metrics must NOT be logged at ERROR level
        assert "revenue" not in log_msg.lower()
        assert "transaction" not in log_msg.lower()

    @pytest.mark.asyncio
    async def test_financial_exposure_exact_value_not_logged_in_info(self, db_session: Session, caplog):
        """Verify that the exact dollar value of total_daily_revenue_exposure does not appear in INFO logs."""
        biz = Business(name="Fin Logging Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        provider = MockLLMProvider()
        service = InvestigationService(uow=uow, provider=provider)

        caplog.set_level(logging.INFO)
        await service.investigate(
            business=biz,
            question="Summarize our financial risks.",
            days=30,
        )

        analytics_logs = [
            record.message for record in caplog.records
            if "Investigation deterministic analytics retrieved" in record.message
        ]
        assert len(analytics_logs) == 1
        log_msg = analytics_logs[0]
        assert "fin_exposure=" in log_msg
        assert "fin_exp=$" not in log_msg
        # Ensure no concrete dollar amounts appear in this operational analytics log
        assert "$" not in log_msg


# ---------------------------------------------------------------------------
# 5. API Boundary Integration & Security Invariants
# ---------------------------------------------------------------------------

class TestAPIBoundaryAndSecurity:
    def test_malformed_llm_output_returns_502_bad_gateway(self, client: TestClient):
        """Malformed LLM output translates cleanly to HTTP 502 Bad Gateway at the API router."""
        mock_service = AsyncMock(spec=InvestigationService)
        mock_service.investigate.side_effect = MalformedLLMOutputError("Corrupted JSON output from provider")

        app.dependency_overrides[get_investigation_service] = lambda: mock_service
        try:
            resp = client.post("/api/v1/investigations", json={
                "business_id": 1,
                "question": "What is our risk profile?",
            })
            assert resp.status_code == 502
            assert "unexpected response format" in resp.json()["detail"].lower()
        finally:
            del app.dependency_overrides[get_investigation_service]

    @pytest.mark.asyncio
    async def test_tenant_isolation_preserved_under_hardened_pipeline(self, db_session: Session):
        """Authoritative tenant context is maintained throughout the hardened pipeline."""
        biz_a = Business(name="Tenant Alpha Secure", industry="Retail")
        biz_b = Business(name="Tenant Beta Isolated", industry="Wholesale")
        db_session.add_all([biz_a, biz_b])
        db_session.flush()

        prod_b = Product(business_id=biz_b.id, name="Classified Item B", category="Hardware", sku="ISO-B-99", unit_price=999.0)
        db_session.add(prod_b)
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
            business=biz_a,
            question="Summarize our operations.",
            days=30,
        )

        assert len(captured_user_prompts) == 1
        prompt = captured_user_prompts[0]
        assert "Tenant Alpha Secure" in prompt
        assert "Classified Item B" not in prompt
        assert "ISO-B-99" not in prompt
        assert result.question == "Summarize our operations."
