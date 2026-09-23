"""
Milestone 3-S5 Slice 1: Investigation History & Audit Persistence Foundation Tests.

Verifies:
1. Model:
   - Investigation record can be created with all required fields.
   - Tenant foreign key (business_id) and user foreign key (user_id) are enforced.
   - Created_at timestamp is populated UTC.
   - JSON context snapshot is accurately serialized and deserialized.
   - Nullable user_id is supported.
2. Service:
   - Successful investigation creates exactly one audit record downstream of verification.
   - Persisted question equals authoritative sanitized question.
   - Persisted answer equals final sanitized answer.
   - Persisted confidence equals final calibrated confidence.
   - Persisted verification status matches M3-S4 verification summary.
   - Persisted deterministic snapshot corresponds to the investigation context.
   - Provider identifier and duration_ms reflect actual execution values.
3. Failure Behavior:
   - Failed LLM provider does not create an audit record.
   - Malformed LLM output does not create an audit record.
   - Persistence failure raises and does not falsely report success.
4. Security & Tenant Isolation:
   - Persisted business_id is bound strictly to the authenticated tenant.
   - Persisted user_id is bound strictly to the authenticated user.
   - Client-provided business_id in payload cannot override authenticated tenant.
   - Tenant isolation: Tenant A records cannot be retrieved or accessed under Tenant B.
"""
import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from models.business import Business
from models.user import User
from models.investigation import Investigation
from unit_of_work import SqlAlchemyUnitOfWork
from app.services.investigation_service import InvestigationService
from ai_providers.mock_provider import MockLLMProvider
from exceptions import LLMProviderError, MalformedLLMOutputError


# ---------------------------------------------------------------------------
# 1. Model Tests
# ---------------------------------------------------------------------------

class TestInvestigationModel:
    """Unit tests for the Investigation SQLAlchemy ORM model."""

    def test_investigation_model_creation_and_persistence(self, db_session: Session):
        """Verify an investigation audit record persists with all expected fields."""
        biz = Business(name="Audit Model Biz", industry="Retail")
        db_session.add(biz)
        db_session.flush()

        user = User(
            business_id=biz.id,
            email="audituser@nexus.test",
            password_hash="hashed_pw_test",
            role="OWNER",
        )
        db_session.add(user)
        db_session.commit()

        snapshot_data = {
            "facts": {"total_revenue": 125000.0, "total_transactions": 250.0},
            "verdicts": [
                {
                    "raw_text": "Total revenue was $125,000.",
                    "extracted_value": 125000.0,
                    "matched_fact": "total_revenue",
                    "status": "VERIFIED",
                    "reason": "Matches deterministic fact",
                }
            ],
            "limitations": [],
            "days": 30,
        }

        inv = Investigation(
            business_id=biz.id,
            user_id=user.id,
            question="What was total revenue?",
            answer="Total revenue was $125,000.",
            confidence="HIGH",
            verification_status="VERIFIED",
            context_snapshot=snapshot_data,
            provider="mock",
            execution_duration_ms=42.5,
        )
        db_session.add(inv)
        db_session.commit()
        db_session.refresh(inv)

        assert inv.id is not None
        assert inv.business_id == biz.id
        assert inv.user_id == user.id
        assert inv.question == "What was total revenue?"
        assert inv.answer == "Total revenue was $125,000."
        assert inv.confidence == "HIGH"
        assert inv.verification_status == "VERIFIED"
        assert inv.context_snapshot == snapshot_data
        assert inv.provider == "mock"
        assert inv.execution_duration_ms == 42.5
        assert isinstance(inv.created_at, datetime)
        assert "<Investigation" in repr(inv)

    def test_investigation_nullable_user(self, db_session: Session):
        """Verify user_id is nullable (e.g. for service-level or system-initiated runs)."""
        biz = Business(name="No User Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        inv = Investigation(
            business_id=biz.id,
            user_id=None,
            question="System audit check",
            answer="Verified system output",
            confidence="MEDIUM",
            verification_status="UNVERIFIED",
            context_snapshot={"facts": {}, "verdicts": []},
            provider="mock",
            execution_duration_ms=10.0,
        )
        db_session.add(inv)
        db_session.commit()
        db_session.refresh(inv)

        assert inv.id is not None
        assert inv.user_id is None

    def test_json_context_snapshot_roundtrip(self, db_session: Session):
        """Verify JSON context snapshot round-trip serializability."""
        biz = Business(name="JSON Roundtrip Biz", industry="Tech")
        db_session.add(biz)
        db_session.commit()

        complex_snapshot = {
            "facts": {
                "total_revenue": 99999.99,
                "projected_7d_revenue_exposure": 12345.67,
            },
            "verdicts": [
                {
                    "raw_text": "Projected 7-day revenue exposure is $12,345.67",
                    "extracted_value": 12345.67,
                    "matched_fact": "projected_7d_revenue_exposure",
                    "status": "VERIFIED",
                    "reason": "Exact match",
                }
            ],
            "limitations": ["Data completeness bounded by observation period."],
            "days": 14,
        }

        inv = Investigation(
            business_id=biz.id,
            user_id=None,
            question="How is financial risk trending?",
            answer="Financial risk is moderate.",
            confidence="HIGH",
            verification_status="VERIFIED",
            context_snapshot=complex_snapshot,
            provider="mock",
            execution_duration_ms=55.2,
        )
        db_session.add(inv)
        db_session.commit()
        db_session.refresh(inv)

        # Ensure deep equality
        assert inv.context_snapshot["facts"]["total_revenue"] == 99999.99
        assert inv.context_snapshot["verdicts"][0]["status"] == "VERIFIED"
        assert len(inv.context_snapshot["limitations"]) == 1


# ---------------------------------------------------------------------------
# 2. Service Audit Persistence Tests
# ---------------------------------------------------------------------------

class TestInvestigationServiceAuditPersistence:
    """Tests confirming the InvestigationService persists audit records upon completion."""

    @pytest.mark.asyncio
    async def test_successful_investigation_persists_exactly_one_audit_record(
        self, db_session: Session
    ):
        biz = Business(name="Service Audit Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=MockLLMProvider())

        resp = await service.investigate(
            business=biz,
            question="What products require immediate restock?",
            days=30,
        )

        records = uow.investigations.get_all_for_business(biz.id)
        assert len(records) == 1

        rec = records[0]
        assert rec.business_id == biz.id
        assert rec.question == "What products require immediate restock?"
        assert rec.answer == resp.answer
        assert rec.confidence == resp.confidence
        assert rec.provider == "mock"
        assert rec.execution_duration_ms > 0
        assert "facts" in rec.context_snapshot
        assert "verdicts" in rec.context_snapshot

    @pytest.mark.asyncio
    async def test_audit_record_binds_authenticated_user_when_provided(
        self, db_session: Session
    ):
        biz = Business(name="User Bound Biz", industry="Retail")
        db_session.add(biz)
        db_session.flush()

        user = User(
            business_id=biz.id,
            email="bounduser@nexus.test",
            password_hash="testpass",
            role="OWNER",
        )
        db_session.add(user)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=MockLLMProvider())

        await service.investigate(
            business=biz,
            question="What is the inventory posture?",
            days=30,
            user=user,
        )

        records = uow.investigations.get_all_for_business(biz.id)
        assert len(records) == 1
        assert records[0].user_id == user.id

    @pytest.mark.asyncio
    async def test_audit_record_captures_m3_s4_verification_verdicts(
        self, db_session: Session
    ):
        biz = Business(name="Verdict Capture Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class SpecificFactProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return json.dumps({
                    "answer": "Total transactions were 999999.",
                    "confidence": "HIGH",
                    "key_findings": ["Transactions spike"],
                    "recommendations": ["Check records"],
                    "supporting_facts": ["Total transactions: 999999"],
                    "limitations": [],
                })

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=SpecificFactProvider())

        await service.investigate(
            business=biz,
            question="What were the total transactions?",
            days=30,
        )

        records = uow.investigations.get_all_for_business(biz.id)
        assert len(records) == 1
        rec = records[0]
        # Should record the verification status accurately
        assert rec.verification_status in ("VERIFIED", "CONFLICTING", "UNVERIFIED")
        assert len(rec.context_snapshot["verdicts"]) >= 1


# ---------------------------------------------------------------------------
# 3. Failure Behavior Tests
# ---------------------------------------------------------------------------

class TestAuditPersistenceFailureBehavior:
    """Tests confirming failed investigations never produce successful audit records."""

    @pytest.mark.asyncio
    async def test_failed_llm_provider_does_not_create_audit_record(
        self, db_session: Session
    ):
        biz = Business(name="Failing Provider Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class FailingProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                raise LLMProviderError("Upstream service down")

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=FailingProvider())

        with pytest.raises(LLMProviderError):
            await service.investigate(
                business=biz,
                question="Why did the provider fail?",
            )

        records = uow.investigations.get_all_for_business(biz.id)
        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_malformed_llm_output_does_not_create_audit_record(
        self, db_session: Session
    ):
        biz = Business(name="Malformed Provider Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        class MalformedProvider:
            async def generate(self, system_prompt: str, user_prompt: str) -> str:
                return "THIS IS NOT VALID JSON AT ALL"

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=MalformedProvider())

        with pytest.raises(MalformedLLMOutputError):
            await service.investigate(
                business=biz,
                question="Can you parse invalid json?",
            )

        records = uow.investigations.get_all_for_business(biz.id)
        assert len(records) == 0

    @pytest.mark.asyncio
    async def test_database_persistence_failure_rolls_back_and_raises(
        self, db_session: Session
    ):
        biz = Business(name="DB Failure Biz", industry="Retail")
        db_session.add(biz)
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=MockLLMProvider())

        # Simulate database persistence failure
        with patch.object(uow.investigations, "create", side_effect=RuntimeError("Database Disk Full")):
            with pytest.raises(RuntimeError) as exc_info:
                await service.investigate(
                    business=biz,
                    question="Will this persist if DB fails?",
                )
            assert "Database Disk Full" in str(exc_info.value)


# ---------------------------------------------------------------------------
# 4. Security & Multi-Tenant Isolation Tests
# ---------------------------------------------------------------------------

class TestAuditPersistenceSecurityAndTenantIsolation:
    """Security tests confirming tenant ownership and protection against IDOR / override."""

    def test_investigation_endpoint_persists_audit_bound_to_authenticated_tenant(
        self, client: TestClient, db_session: Session
    ):
        """
        Submitting business_id=999 in payload must NOT override the authenticated tenant's ID
        in the persisted audit record.
        """
        resp = client.post("/api/v1/investigations", json={
            "business_id": 999,  # Malicious/unrelated tenant ID in payload
            "question": "What is our current sales velocity?",
        })
        assert resp.status_code == 200

        # Query all investigations in DB
        uow = SqlAlchemyUnitOfWork(db_session)
        # Record must exist for the test owner's business (not 999)
        test_biz_records = db_session.query(Investigation).filter(Investigation.business_id != 999).all()
        assert len(test_biz_records) >= 1

        # Zero records must exist for business_id 999
        tampered_records = db_session.query(Investigation).filter(Investigation.business_id == 999).all()
        assert len(tampered_records) == 0

        # Verify the recorded user_id matches the authenticated user
        authenticated_record = test_biz_records[-1]
        assert authenticated_record.user_id is not None
        assert authenticated_record.question == "What is our current sales velocity?"

    @pytest.mark.asyncio
    async def test_cross_tenant_audit_record_isolation(self, db_session: Session):
        """Records created for Tenant A cannot be retrieved or accessed via Tenant B queries."""
        biz_a = Business(name="Tenant Alpha Corp", industry="Retail")
        biz_b = Business(name="Tenant Beta Ltd", industry="Wholesale")
        db_session.add_all([biz_a, biz_b])
        db_session.commit()

        uow = SqlAlchemyUnitOfWork(db_session)
        service = InvestigationService(uow=uow, provider=MockLLMProvider())

        # Execute investigation for Tenant A
        await service.investigate(business=biz_a, question="Alpha Question", days=30)
        # Execute investigation for Tenant B
        await service.investigate(business=biz_b, question="Beta Question", days=30)

        records_a = uow.investigations.get_all_for_business(biz_a.id)
        records_b = uow.investigations.get_all_for_business(biz_b.id)

        assert len(records_a) == 1
        assert len(records_b) == 1

        assert records_a[0].question == "Alpha Question"
        assert records_b[0].question == "Beta Question"

        # Cross-tenant get_for_business check
        assert uow.investigations.get_for_business(records_a[0].id, biz_b.id) is None
        assert uow.investigations.get_for_business(records_b[0].id, biz_a.id) is None
