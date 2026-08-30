# NEXUS Data Layer Module

## Purpose
The `data-layer` module encapsulates all persistence models, data access schemas, and repository interfaces for the NEXUS platform.

## Architecture
- **Engine & Sessions** (`database.py`): SQLAlchemy 2.0 engine, declarative base, SQLite foreign key pragma enforcer, and session lifecycle generators.
- **ORM Models** (`models/`):
  - `Business`: Core organization / tenant entity.
  - `Product`: SKU catalog item with unique constraint on `(business_id, sku)`.
  - `Inventory`: 1-to-1 stock and reorder threshold tracker for each product.
  - `Transaction`: Financial and business transaction record.
  - `TransactionItem`: Line item linking transactions and products.
- **Pydantic Schemas** (`schemas/`): Request validation and typed serialization models.
- **Repositories** (`repositories/`): Data access abstraction layer isolating database queries from HTTP route controllers.

## Status: Phase 1A (Complete)
- **Currently Implemented**:
  - Full relational schema across 5 core entities with foreign key constraints.
  - CRUD repository classes with transactional safety.
  - SQLite auto-initialization via `init_db()`.
