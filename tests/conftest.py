"""Pytest global configuration and fixtures."""
import sys
from pathlib import Path
from typing import Generator
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Ensure data-layer, recommendation-engine, ai-llm-integration, and backend paths are in sys.path
root_dir = Path(__file__).resolve().parent.parent
data_layer_dir = root_dir / "data-layer"
rec_engine_dir = root_dir / "recommendation-engine"
ai_llm_dir = root_dir / "ai-llm-integration"
backend_dir = root_dir / "backend"

for p in [str(data_layer_dir), str(rec_engine_dir), str(ai_llm_dir), str(backend_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)



from database import Base, get_db
from app.main import app
from fastapi.testclient import TestClient

# SQLite test engine with in-memory static pool to persist schema across threads
TEST_DATABASE_URL = "sqlite:///:memory:"

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints in SQLite test engine."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False,
)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Provide a transactional test database session."""
    # Create all tables
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test function
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with overridden database dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
