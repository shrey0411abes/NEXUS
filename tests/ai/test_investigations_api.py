"""
Phase 2 API integration tests for POST /api/v1/investigations (auth-aware).
The investigations endpoint now uses the authenticated tenant's business exclusively.
"""
import pytest
from fastapi.testclient import TestClient


class TestInvestigationEndpoint:
    def test_valid_investigation_with_mock_provider(self, client: TestClient):
        """Investigations use the authenticated tenant's business context."""
        resp = client.post("/api/v1/investigations", json={
            "business_id": 1,  # payload business_id is ignored by the endpoint; auth tenant is used
            "question": "What should I reorder this week?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "answer" in data
        assert data["confidence"] in ("HIGH", "MEDIUM", "LOW")
        assert isinstance(data["key_findings"], list)
        assert isinstance(data["supporting_facts"], list)
        assert isinstance(data["recommendations"], list)
        assert isinstance(data["limitations"], list)

    def test_unauthenticated_investigation_returns_401(self, unauth_client: TestClient):
        """Unauthenticated investigation requests must return 401."""
        resp = unauth_client.post("/api/v1/investigations", json={
            "business_id": 1,
            "question": "What should I reorder?",
        })
        assert resp.status_code == 401

    def test_empty_question_returns_422(self, client: TestClient):
        resp = client.post("/api/v1/investigations", json={
            "business_id": 1,
            "question": "",
        })
        assert resp.status_code == 422

    def test_whitespace_question_returns_422(self, client: TestClient):
        resp = client.post("/api/v1/investigations", json={
            "business_id": 1,
            "question": "   ",
        })
        assert resp.status_code == 422

    def test_zero_business_id_returns_422(self, client: TestClient):
        resp = client.post("/api/v1/investigations", json={
            "business_id": 0,
            "question": "Valid question here",
        })
        assert resp.status_code == 422

    def test_missing_provider_returns_503(self, client: TestClient):
        original = client.app.state.llm_provider
        client.app.state.llm_provider = None
        try:
            resp = client.post("/api/v1/investigations", json={
                "business_id": 1,
                "question": "What are my concerns?",
            })
            assert resp.status_code == 503
        finally:
            client.app.state.llm_provider = original

    def test_malformed_provider_response_returns_502(self, client: TestClient):
        class BrokenProvider:
            async def generate(self, system_prompt, user_prompt):
                return "NOT VALID JSON !!!"

        original = client.app.state.llm_provider
        client.app.state.llm_provider = BrokenProvider()
        try:
            resp = client.post("/api/v1/investigations", json={
                "business_id": 1,
                "question": "What products need attention?",
            })
            assert resp.status_code == 502
        finally:
            client.app.state.llm_provider = original

    def test_provider_error_returns_503(self, client: TestClient):
        from exceptions import LLMProviderError

        class FailingProvider:
            async def generate(self, system_prompt, user_prompt):
                raise LLMProviderError("Simulated API failure")

        original = client.app.state.llm_provider
        client.app.state.llm_provider = FailingProvider()
        try:
            resp = client.post("/api/v1/investigations", json={
                "business_id": 1,
                "question": "What are the trends?",
            })
            assert resp.status_code == 503
        finally:
            client.app.state.llm_provider = original

    def test_custom_days_window_accepted(self, client: TestClient):
        resp = client.post("/api/v1/investigations", json={
            "business_id": 1,
            "question": "How is revenue trending over 7 days?",
            "days": 7,
        })
        assert resp.status_code == 200

    def test_investigation_with_no_transaction_data_returns_valid_response(self, client: TestClient):
        """A new business with zero transactions should still return a valid structured response."""
        resp = client.post("/api/v1/investigations", json={
            "business_id": 1,
            "question": "What are my biggest inventory concerns?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["confidence"] in ("HIGH", "MEDIUM", "LOW")
