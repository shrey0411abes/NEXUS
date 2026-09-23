# ADR 0003: Database Migrations via Alembic & Authoritative Monetary Precision

## Status
Accepted (Phase P1)

## Context
During the NEXUS BuildSprint/hackathon prototype phase:
1. Database schema lifecycle relied on SQLAlchemy's `Base.metadata.create_all()` executed inside the FastAPI `lifespan` startup hook. This prevented version-controlled schema evolution, non-destructive migrations, rollbacks, and multi-developer schema synchronization.
2. Authoritative monetary amounts (`Product.unit_price`, `Transaction.total_amount`, `TransactionItem.unit_price`, analytics revenue totals, and financial exposure valuations) were modeled using floating-point types (`Float` in SQLAlchemy, `float` in Python). Binary floating-point representation (IEEE 754) introduces non-deterministic rounding artifacts (e.g. `0.1 + 0.2 = 0.30000000000000004`), which is unacceptable for enterprise financial and retail intelligence systems.

## Decisions

### 1. Version-Controlled Schema Management via Alembic
- Alembic is established as the sole authoritative schema migration pipeline for NEXUS.
- The migration environment is located in `/alembic` with configuration in `/alembic.ini`.
- `env.py` dynamically resolves the database URL from `DATABASE_URL` / configuration while discovering SQLAlchemy ORM models from `data-layer/models/` via `Base.metadata`.
- The initial schema migration `0001_initial_schema.py` encapsulates all 5 core tables (`businesses`, `products`, `inventories`, `transactions`, `transaction_items`), check constraints, foreign keys, and the performance composite covering index `ix_transactions_business_date_type`.

### 2. Removal of `create_all()` from Production Lifespan
- `Base.metadata.create_all()` has been removed from `backend/app/main.py` lifespan startup.
- Production and staging deployments manage schema state exclusively through explicit migration commands (`alembic upgrade head`).
- Fast, isolated unit and integration test fixtures (`tests/conftest.py`) continue to utilize ephemeral SQLite in-memory or temporary database tables created via `Base.metadata.create_all(bind=engine)` to ensure zero external dependency coupling and maximum execution speed.

### 3. Monetary Precision Hardening: SQL `Numeric(12, 2)` & Python `Decimal`
- Authoritative monetary amounts in database tables are defined using `Numeric(12, 2)` (precision 12, scale 2), supporting monetary values up to \$9,999,999,999.99 with exact cent precision.
- Python domain models, ORM entities, repositories, and calculation pipelines represent monetary values strictly using Python's standard library `decimal.Decimal`.
- Floating-point casting is prohibited during financial arithmetic. Safe Decimal construction is enforced via string conversions or exact integer multiplications.

### 4. Rounding Policy: Explicit `ROUND_HALF_UP`
- Financial rounding boundaries employ `decimal.ROUND_HALF_UP` (standard commercial/retail rounding where 0.5 cents rounds away from zero).
- Intermediate calculations maintain full Decimal precision and are quantized to `Decimal("0.01")` using `ROUND_HALF_UP` at defined business boundaries (e.g., transaction line item sum, daily revenue exposure, trapped inventory valuation).

### 5. Classification of Monetary vs. Non-Monetary Values

#### Authoritative Monetary Values (Hardened to `Decimal` / `Numeric(12, 2)`):
- `Product.unit_price`
- `Transaction.total_amount`
- `TransactionItem.unit_price`
- `BusinessKPIs.total_revenue`
- `BusinessKPIs.average_transaction_value`
- `ProductSalesMetrics.total_revenue`
- `ProductSalesMetrics.average_daily_revenue`
- `SKUFinancialImpact.unit_price`
- `SKUFinancialImpact.daily_revenue_exposure`
- `SKUFinancialImpact.projected_7d_revenue_exposure`
- `SKUFinancialImpact.projected_30d_revenue_exposure`
- `SKUFinancialImpact.retail_value_on_hand`
- `SKUFinancialImpact.trapped_retail_inventory_value`
- `BusinessFinancialSummary.total_daily_revenue_exposure`
- `BusinessFinancialSummary.projected_7d_revenue_exposure`
- `BusinessFinancialSummary.projected_30d_revenue_exposure`
- `BusinessFinancialSummary.total_trapped_retail_inventory_value`
- `BusinessFinancialSummary.total_retail_inventory_value_on_hand`

#### Non-Monetary Values (Intentionally Kept as `int` / `float`):
- Inventory quantities (`quantity`, `reorder_level`): `int`
- Sales velocity (`units / day` rate): `float` (rounded to 4 decimals)
- Days of Inventory coverage (`days` ratio): `float` (rounded to 1 decimal)
- Anomaly / correlation confidence / risk scores: `float`
- Percentage changes / surge ratios: `float`

### 6. Dual Dialect Readiness (SQLite & PostgreSQL)
- SQLite PRAGMAs (`PRAGMA foreign_keys=ON`, `PRAGMA busy_timeout=5000`) and SQLite-specific connection arguments (`check_same_thread=False`) are executed conditionally based on `engine.dialect.name == "sqlite"`.
- PostgreSQL connection strings and execution pipelines are fully supported by SQLAlchemy `Numeric(12, 2)` and Alembic standard DDL without dialect lock-in.

### 7. Fresh Database Initialization vs. Existing Database Baselining
- **Fresh Database**: Running `alembic upgrade head` provisions all tables, constraints, indexes, and stamps the revision at `head`.
- **Existing NEXUS Database**: Existing databases with active data can be stamped without data loss via `alembic stamp head`.

### 8. Pydantic API Compatibility & JSON Serialization
- Pydantic v2 domain schemas hold `Decimal` values internally for rigorous type validation.
- Fields utilize `@field_serializer(..., when_used="json-unless-none")` returning standard two-decimal floats to guarantee 100% backward compatibility with existing REST API clients and the React frontend without breaking client JSON parsers.

## Consequences

### Positive
- Authoritative financial data is 100% immune to IEEE 754 binary floating-point drift.
- `$0.10 + $0.20 == $0.30` is mathematically guaranteed across the entire system.
- Database schema changes are auditable, reversible, and version-controlled.
- Clean separation between application startup and database migration lifecycle.
- 100% regression pass rate across all 116 unit, integration, and API tests.
- React frontend builds with zero errors.

### Trade-offs & Operational Notes
- Developers creating new schema modifications must generate Alembic migration files rather than modifying ORM models in isolation.
- Minor computational overhead of `Decimal` compared to hardware floating-point, negligible for transaction and analytics workloads.
