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
from app.core.security import hash_password, create_access_token
from fastapi.testclient import TestClient
from models.business import Business
from models.user import User

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


def _make_test_owner(db: Session) -> tuple[Business, User, str]:
    """
    Create a test Business + OWNER User and return (business, user, access_token).
    Used by auth-aware fixtures to provide a valid JWT for protected endpoints.
    """
    business = Business(name="Test Business", industry="Testing")
    db.add(business)
    db.flush()

    user = User(
        business_id=business.id,
        email="testowner@nexus.test",
        password_hash=hash_password("TestPass123"),
        role="OWNER",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(business)
    db.refresh(user)

    token = create_access_token(
        subject=str(user.id),
        business_id=business.id,
        role=user.role,
    )
    return business, user, token


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    FastAPI TestClient with overridden database dependency and pre-seeded auth token.
    Provides Authorization header automatically so that existing tests continue to
    pass without modification after auth guards were added in Milestone 1.
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    # Seed a test business + owner user and create a valid JWT
    _, _, token = _make_test_owner(db_session)

    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def unauth_client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    FastAPI TestClient WITHOUT authentication headers.
    Used to verify that protected endpoints correctly return 401.
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_context(db_session: Session) -> dict:
    """
    Create and return a test Business + OWNER User + JWT token dict.
    Useful when a test needs both a TestClient AND direct access to the business/user objects.
    Returns: {"business": Business, "user": User, "token": str}
    """
    business, user, token = _make_test_owner(db_session)
    return {"business": business, "user": user, "token": token}


@pytest.fixture(scope="function")
def auth_client_factory(db_session: Session):
    """
    Factory fixture that creates a TestClient authenticated as a specific User.
    Used by security tests to create multiple tenants and test cross-tenant isolation.

    Usage:
        client_a = auth_client_factory(token_a)
        client_b = auth_client_factory(token_b)
    """
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    # Ensure app.state.llm_provider is initialized
    if not getattr(app.state, "llm_provider", None):
        try:
            from client import create_provider
            app.state.llm_provider = create_provider(
                provider_name="mock",
                api_key=None,
                model="gemini-2.5-flash",
                timeout_seconds=30.0,
            )
            app.state.llm_provider_name = "mock"
        except Exception:
            pass

    def make(token: str) -> TestClient:
        return TestClient(app, headers={"Authorization": f"Bearer {token}"})

    yield make

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter_per_test():
    """Reset global in-memory rate limiter state per test function to prevent cross-test leakage."""
    try:
        from app.core.rate_limiter import limiter
        limiter.reset()
        limiter.set_time_func(None)
    except ImportError:
        pass
    yield
    try:
        from app.core.rate_limiter import limiter
        limiter.reset()
        limiter.set_time_func(None)
    except ImportError:
        pass

