"""Tests for the /health endpoint."""
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure backend app package is importable
backend_dir = Path(__file__).resolve().parent.parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

client = TestClient(app)


def test_health_check_returns_200_and_valid_payload():
    """Verify that GET /health responds with 200 OK and expected structure."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data
    assert "version" in data
    assert "timestamp" in data
    assert "environment" in data
