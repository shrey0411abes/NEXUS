"""Tests for database initialization and metadata."""
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from database import Base, init_db


def test_database_tables_created(db_session: Session):
    """Verify that all 5 domain tables are successfully created in the schema."""
    inspector = inspect(db_session.bind)
    tables = inspector.get_table_names()

    expected_tables = {
        "businesses",
        "products",
        "inventories",
        "transactions",
        "transaction_items",
    }

    assert expected_tables.issubset(set(tables)), f"Missing tables: {expected_tables - set(tables)}"


def test_init_db_functionality(db_session: Session):
    """Verify that init_db executes cleanly without exceptions."""
    init_db(target_engine=db_session.bind)
    inspector = inspect(db_session.bind)
    assert "businesses" in inspector.get_table_names()
