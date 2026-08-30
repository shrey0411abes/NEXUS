# NEXUS System Architecture

## 1. Architectural Overview

NEXUS is designed as a **Modular Monolith** engineered for high maintainability, low operational complexity, and strict domain separation. This architecture supports rapid iteration during the 48-hour BuildSprint while preserving clean boundaries for long-term scalability.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend API (FastAPI Gateway)               │
│          Routing • Validation • Application Orchestration   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Data Layer Module       │ │   Recommendation Engine    │
│  Schemas • DB Repositories   │ │  Deterministic BI Logic   │
└──────────────────────────────┘ └────────────┬───────────────┘
                                              │ Context / Signals
                                              ▼
                                 ┌────────────────────────────┐
                                 │     AI/LLM Integration     │
                                 │   Provider Abstractions    │
                                 │   Natural Language & RAG   │
                                 └────────────────────────────┘
```

---

## 2. Module Responsibilities & Boundaries

### 2.1 `frontend/` (Presentation Layer)
- **Role**: Clean, component-based user interface built with React, TypeScript, and Vite.
- **Boundary**: Communicates solely with the Backend API layer over standard REST/JSON endpoints.
- **Constraints**: Contains no direct database calls, LLM keys, or core business calculation logic.

### 2.2 `backend/` (Application Orchestration & API Gateway)
- **Role**: Handles HTTP request parsing, Pydantic input/output validation, error handling, CORS, and orchestrates workflows between domain modules.
- **Boundary**: Does not contain raw business formulas or vendor-specific LLM implementations directly within endpoint handlers.

### 2.3 `data-layer/` (Persistence & Schemas)
- **Role**: Encapsulates database models, schemas, and data-access abstractions.
- **Boundary**: Provides structured repositories to the backend orchestration layer.
- **Status in Phase 0**: Package scaffolding; database models and engine will be designed in subsequent phases after requirements definition.

### 2.4 `recommendation-engine/` (Deterministic Business Intelligence)
- **Role**: Executes deterministic business calculations, anomaly detection, risk scoring, and metric aggregations.
- **Boundary**: Pure algorithmic/computational domain. Must **never** depend on HTTP routes, web frameworks, or the React frontend.
- **Status in Phase 0**: Module scaffolding; zero mock/fake algorithms.

### 2.5 `ai-llm-integration/` (Contextual Reasoning & LLM Interface)
- **Role**: Encapsulates LLM provider clients, prompt templates, structured output parsing, and natural-language query resolution.
- **Boundary**: Isolated interface layer. The LLM is **not** the source of truth for business math; it consumes verified deterministic outputs from the recommendation engine to explain, summarize, and assist users.
- **Status in Phase 0**: Module scaffolding; zero external AI vendor dependencies.

---

## 3. Strict Dependency Direction

NEXUS enforces a unidirectional dependency hierarchy:

```
Frontend ──► Backend API ──► Orchestration ──► [Data Layer + Recommendation Engine] ──► AI/LLM Integration
```

- **Deterministic Rule**: Mathematical aggregations and threshold evaluations must always occur deterministically within `recommendation-engine`.
- **Reasoning Rule**: The `ai-llm-integration` layer operates on top of deterministic business signals for explanation, synthesis, and conversational interaction.

---

## 4. Scalability & Evolution

1. **Sprint Phase**: Runs as a cohesive modular repository with zero runtime microservice overhead.
2. **Growth Phase**: Because module boundaries are strictly isolated with dedicated interfaces, individual modules (such as the recommendation engine or AI inference workers) can be extracted into dedicated microservices or background queues without rewriting core domain logic.
