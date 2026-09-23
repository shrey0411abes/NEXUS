"""
Tests for Phase P1 Alembic Migration Pipeline, Schema Lifecycle, and Dialect Readiness.
"""
import os
import tempfile
from pathlib import Path
import pytest
from sqlalchemy import create_engine, inspect, text
from alembic.config import Config
from alembic import command


def get_alembic_config(db_url: str) -> Config:
    """Construct an Alembic Config pointing to the project's alembic.ini with dynamic target db URL."""
    root_dir = Path(__file__).resolve().parent.parent.parent
    ini_path = root_dir / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)
    return alembic_cfg


def test_fresh_database_alembic_migration_lifecycle():
    """Verify that an empty database is fully provisioned to head via Alembic migrations."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    try:
        db_url = f"sqlite:///{tmp_db_path}"
        cfg = get_alembic_config(db_url)

        # 1. Upgrade from empty to head
        command.upgrade(cfg, "head")

        # 2. Inspect created schema
        engine = create_engine(db_url)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())

        expected_tables = {
            "businesses",
            "products",
            "inventories",
            "transactions",
            "transaction_items",
            "users",
            "investigations",
            "risk_actions",
            "alembic_version",
        }
        assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

        # 3. Verify Alembic current version matches head
        with engine.connect() as conn:
            current_rev = conn.scalar(text("SELECT version_num FROM alembic_version"))
            assert current_rev == "0004_risk_actions_schema"

        # 4. Verify monetary column types on products and transactions
        product_cols = {col["name"]: col for col in inspector.get_columns("products")}
        assert "unit_price" in product_cols
        # SQLite column types in SQLAlchemy reflection for Numeric(12, 2)
        assert str(product_cols["unit_price"]["type"]).startswith("NUMERIC")

        tx_cols = {col["name"]: col for col in inspector.get_columns("transactions")}
        assert "total_amount" in tx_cols
        assert str(tx_cols["total_amount"]["type"]).startswith("NUMERIC")

        tx_item_cols = {col["name"]: col for col in inspector.get_columns("transaction_items")}
        assert "unit_price" in tx_item_cols
        assert str(tx_item_cols["unit_price"]["type"]).startswith("NUMERIC")

        # Verify users columns
        user_cols = {col["name"]: col for col in inspector.get_columns("users")}
        assert "email" in user_cols
        assert "password_hash" in user_cols
        assert "role" in user_cols
        assert "is_active" in user_cols

        # 5. Verify indexes
        tx_indexes = {idx["name"]: idx for idx in inspector.get_indexes("transactions")}
        assert "ix_transactions_business_date_type" in tx_indexes
        assert tx_indexes["ix_transactions_business_date_type"]["column_names"] == [
            "business_id",
            "transaction_date",
            "transaction_type",
        ]

        user_indexes = {idx["name"]: idx for idx in inspector.get_indexes("users")}
        assert "ix_users_email" in user_indexes
        assert "ix_users_business_id" in user_indexes

        # 6. Verify Downgrade to base
        command.downgrade(cfg, "base")
        inspector_after_downgrade = inspect(engine)
        remaining_tables = set(inspector_after_downgrade.get_table_names()) - {"alembic_version"}
        assert len(remaining_tables) == 0, f"Tables not dropped: {remaining_tables}"

        # 7. Verify Re-upgrade to head
        command.upgrade(cfg, "head")
        inspector_reup = inspect(engine)
        assert expected_tables.issubset(set(inspector_reup.get_table_names()))

        # 8. Verify alembic check detects no drift between ORM models and migrated schema
        command.check(cfg)

        engine.dispose()
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except PermissionError:
                pass


def test_alembic_check_detects_drift():
    """Verify that alembic command.check succeeds against a migrated database."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp_db:
        tmp_db_path = tmp_db.name

    try:
        db_url = f"sqlite:///{tmp_db_path}"
        cfg = get_alembic_config(db_url)
        command.upgrade(cfg, "head")
        # Should raise no exception when schema and metadata match
        command.check(cfg)
    finally:
        if os.path.exists(tmp_db_path):
            try:
                os.remove(tmp_db_path)
            except PermissionError:
                pass

