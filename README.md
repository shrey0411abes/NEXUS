# NEXUS — AI Business Operating System

> **A modular, full-stack business intelligence and decision-support platform engineered for small businesses and independent retailers.**

Developed with an uncompromising emphasis on clean modular architecture, deterministic analytics, and grounded AI reasoning.

---

## 1. Core Architectural Invariant

NEXUS strictly enforces a unidirectional data-intelligence hierarchy:

```text
SQLite SOURCE OF TRUTH
        ↓
Data Layer / Repositories
        ↓
Deterministic Analytics
        ↓
Cross-Domain Correlation (Phase 3A)
        ↓
Operational Risk Prioritization (Phase 3B)
        ↓
Financial Intelligence & Revenue Exposure (Phase 4A)
        ↓
Verified AI Context
        ↓
AI/LLM Interpretation (google-genai / Mock)
        ↓
FastAPI REST API
        ↓
React Frontend Command Center
```

**Non-Negotiable Principle:** The LLM is strictly an **interpreter and explainer** of verified business facts — NEVER the source of truth, NEVER an arithmetic calculator, and NEVER an estimator of missing business metrics.

---

## 2. Implemented Capabilities by Phase

| Phase | Component | Status | Details |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Monolithic Shell & Health Telemetry | **IMPLEMENTED** | Modular layout, FastAPI gateway, configuration templates, `/health` endpoint. |
| **Phase 1A** | Data Layer & Persistence | **IMPLEMENTED** | SQLAlchemy 2.0 ORM, SQLite source of truth, cascade rules, CheckConstraints, FK enforcement. |
| **Phase 1B** | Deterministic Analytics Engine | **IMPLEMENTED** | Sales velocity, days of inventory, stockout risks, dual-window demand trends, volume anomalies. |
| **Phase 2** | AI Business Investigation | **IMPLEMENTED** | Provider abstraction (`MockLLMProvider`, `GeminiProvider` via official `google-genai`), anti-hallucination contract. |
| **Phase 3A** | Cross-Domain Risk Correlation | **IMPLEMENTED** | Multi-signal collision detection (`SURGE_STOCKOUT_SQUEEZE`, `ACCELERATING_DEPLETION`, `DEAD_STOCK_CAPITAL_TRAP`). |
| **Phase 3B** | Operational Risk Prioritization | **IMPLEMENTED** | Deterministic scoring $[0..100]$ and sequential $[1..N]$ queue answering *"What requires attention now, and why?"* |
| **Phase 4A** | Revenue Exposure & Asset Intelligence | **IMPLEMENTED** | Daily revenue exposure ($/day), deterministic 7d/30d projections, trapped retail inventory valuation. |
| **Phase 5** | Database Indexing & Query Hardening | **IMPLEMENTED** | Covering composite index `ix_transactions_business_date_type` providing zero-table-read covering scans. |
| **Phase 6** | Reliability & Integrity Hardening | **IMPLEMENTED** | Cross-business transaction isolation, repository rollback wrappers, busy timeout, global error masking. |

---

## 3. Project Structure

```text
NEXUS/
├── frontend/                 # React + TypeScript + Vite web client & command center
│   └── src/
│       ├── components/       # AnalyticsDashboard, CrossDomainRiskPanel, FinancialImpactPanel, BusinessInvestigation
│       ├── services/         # Typed API client
│       └── types/            # TypeScript interfaces
├── backend/                  # FastAPI orchestration & API gateway
│   └── app/
│       ├── api/v1/endpoints/ # businesses, products, inventory, transactions, analytics, cross_domain, financial, investigations
│       └── core/             # Configuration & environment settings
├── data-layer/               # Database models, schemas & repositories
│   ├── models/               # SQLAlchemy ORM models with CheckConstraints
│   ├── schemas/              # Pydantic validation schemas
│   └── repositories/         # Transactional database access layer
├── recommendation-engine/    # Pure deterministic analytics & heuristics
│   ├── analyzers/            # SalesAnalyzer, InventoryAnalyzer, TrendAnalyzer, FinancialAnalyzer
│   ├── calculators/          # KPI, velocity, coverage, and risk math
│   ├── cross_domain_engine.py# CrossDomainEngine (Phase 3A & Phase 3B)
│   └── engine.py             # RecommendationEngine
├── ai-llm-integration/       # Grounded AI/LLM investigation pipeline
│   ├── ai_context/           # Factual context builder & prompt generator
│   ├── ai_providers/         # LLMProvider Protocol, MockLLMProvider, GeminiProvider (google-genai)
│   ├── ai_schemas/           # InvestigationRequest and InvestigationResponse Pydantic models
│   ├── client.py             # Provider factory & response validation
│   └── investigation_service.py # Investigation orchestrator
├── docs/                     # Architecture documentation, ADRs, runbooks, and audit reports
├── tests/                    # 105+ unit and integration tests across data, analytics, backend, and AI
├── scripts/                  # Standalone verification and seed scripts (seed_demo_data.py, verify_query_plans.py)
├── .env.example              # Environment configuration template
└── README.md                 # Project README
```

---

## 4. Quickstart & Local Setup

### 1. Backend Setup
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Health Check: `http://localhost:8000/health`
- Interactive API Docs (Swagger): `http://localhost:8000/docs`

### 2. Seed Deterministic Demo Data
```powershell
# In a separate terminal from project root:
python scripts/seed_demo_data.py
```

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
- Frontend Command Center: `http://localhost:5173`

---

## 5. Environment Configuration

Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

| Key | Default | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment name |
| `DEBUG` | `true` | Enable debug logs and OpenAPI docs |
| `DATABASE_URL` | `sqlite:///./nexus.db` | SQLite source of truth file |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API URL for Vite client |
| `LLM_PROVIDER` | `mock` | `mock` (deterministic offline mode) or `gemini` |
| `LLM_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `LLM_API_KEY` | *(empty)* | Google AI Studio API key (only if `LLM_PROVIDER=gemini`) |
| `LLM_TIMEOUT_SECONDS` | `30.0` | Timeout threshold for external AI calls |

---

## 6. Testing & Quality Assurance

```powershell
# Run the complete test suite (105+ tests)
python -m pytest tests/ -v

# Run Python compilation check
python -m compileall backend data-layer recommendation-engine ai-llm-integration scripts tests

# Run SQLite query plan verification
python scripts/verify_query_plans.py

# Run Frontend production build
cd frontend
npm run build
```

---

## 7. Prototype Limitations vs. Future Scope

### Prototype Limitations
- **Retail Selling Price Focus:** Analytics currently utilize catalog selling `unit_price`. True gross margin and COGS are withheld until verified supplier purchase costs exist in the database.
- **Single-File SQLite Backend:** Optimized for zero-setup local deployment. High-concurrency enterprise deployments require PostgreSQL.

### Future Scope
- **Phase 4B:** Unit Cost & Margin Intelligence with verified supplier purchase orders.
- **Phase 7:** Supplier Lead Time Tracking and logistics delay forecasting.
- **Phase 8:** Multi-tenant enterprise RBAC and live WebSocket event streaming.
