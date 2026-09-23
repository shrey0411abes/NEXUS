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


def test_sqlite_wal_concurrency_configuration(tmp_path):
    """Verify that SQLite connections are hardened with WAL mode, synchronous=NORMAL, foreign keys, and busy timeout."""
    from sqlalchemy import create_engine, text

    test_db = tmp_path / "nexus_wal_test.db"
    test_engine = create_engine(f"sqlite:///{test_db}")

    with test_engine.connect() as conn:
        journal_mode = conn.execute(text("PRAGMA journal_mode")).scalar()
        synchronous = conn.execute(text("PRAGMA synchronous")).scalar()
        foreign_keys = conn.execute(text("PRAGMA foreign_keys")).scalar()
        busy_timeout = conn.execute(text("PRAGMA busy_timeout")).scalar()

        # SQLite PRAGMA journal_mode returns lowercase "wal"
        assert str(journal_mode).lower() == "wal", f"Expected WAL journal mode, got {journal_mode}"
        # SQLite PRAGMA synchronous returns integer: 0=OFF, 1=NORMAL, 2=FULL, 3=EXTRA
        assert synchronous == 1, f"Expected synchronous=NORMAL (1), got {synchronous}"
        # SQLite PRAGMA foreign_keys returns 1 for ON
        assert foreign_keys == 1, f"Expected foreign_keys=ON (1), got {foreign_keys}"
        # SQLite PRAGMA busy_timeout returns 5000
        assert busy_timeout == 5000, f"Expected busy_timeout=5000, got {busy_timeout}"

    # Also verify default application engine runtime configuration
    from database import engine
    with engine.connect() as app_conn:
        app_journal_mode = app_conn.execute(text("PRAGMA journal_mode")).scalar()
        app_synchronous = app_conn.execute(text("PRAGMA synchronous")).scalar()
        app_foreign_keys = app_conn.execute(text("PRAGMA foreign_keys")).scalar()
        app_busy_timeout = app_conn.execute(text("PRAGMA busy_timeout")).scalar()

        assert str(app_journal_mode).lower() == "wal", f"Expected app engine WAL journal mode, got {app_journal_mode}"
        assert app_synchronous == 1, f"Expected app engine synchronous=NORMAL (1), got {app_synchronous}"
        assert app_foreign_keys == 1, f"Expected app engine foreign_keys=ON (1), got {app_foreign_keys}"
        assert app_busy_timeout == 5000, f"Expected app engine busy_timeout=5000, got {app_busy_timeout}"



def test_sqlite_wal_concurrent_read_write(tmp_path):
    """Verify that SQLite WAL mode allows concurrent readers without blocking writes."""
    from sqlalchemy import create_engine, text

    test_db = tmp_path / "nexus_concurrency_test.db"
    test_engine = create_engine(f"sqlite:///{test_db}")

    with test_engine.connect() as setup_conn:
        setup_conn.execute(text("CREATE TABLE test_kv (k TEXT PRIMARY KEY, v TEXT)"))
        setup_conn.execute(text("INSERT INTO test_kv (k, v) VALUES ('initial', 'val')"))
        setup_conn.commit()

    # Open reader and writer connections simultaneously
    with test_engine.connect() as read_conn, test_engine.connect() as write_conn:
        # Reader reads initial state
        initial_val = read_conn.execute(text("SELECT v FROM test_kv WHERE k = 'initial'")).scalar()
        assert initial_val == "val"

        # Writer performs an insert within transaction
        write_conn.execute(text("INSERT INTO test_kv (k, v) VALUES ('k2', 'val2')"))
        write_conn.commit()

        # Reader can still query cleanly
        read_val = read_conn.execute(text("SELECT count(*) FROM test_kv")).scalar()
        assert read_val == 2

