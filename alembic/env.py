"""Alembic environment configuration for NEXUS database migrations."""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context

# Ensure workspace packages are in sys.path
root_dir = Path(__file__).resolve().parent.parent
data_layer_dir = root_dir / "data-layer"
backend_dir = root_dir / "backend"
rec_engine_dir = root_dir / "recommendation-engine"
ai_llm_dir = root_dir / "ai-llm-integration"

for p in [root_dir, data_layer_dir, backend_dir, rec_engine_dir, ai_llm_dir]:
    if p.exists() and str(p) not in sys.path:
        sys.path.insert(0, str(p))

# Import SQLAlchemy Base and ORM models for autogenerate metadata discovery
from database import Base
import models  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for 'autogenerate' support
target_metadata = Base.metadata


def get_database_url() -> str:
    """Retrieve database URL from alembic config, environment, or application settings."""
    cfg_url = config.get_main_option("sqlalchemy.url")
    if cfg_url and cfg_url != "sqlite:///./nexus.db":
        return cfg_url
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    try:
        from app.core.config import settings
        if settings.DATABASE_URL:
            return settings.DATABASE_URL
    except Exception:
        pass
    return cfg_url or "sqlite:///./nexus.db"


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True if url.startswith("sqlite") else False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    url = get_database_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}

    connectable = create_engine(
        url,
        connect_args=connect_args,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True if url.startswith("sqlite") else False,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
