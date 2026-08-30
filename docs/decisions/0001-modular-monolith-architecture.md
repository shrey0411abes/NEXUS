# ADR 0001: Modular Monolith Architecture & Module Separation

## Status
Accepted

## Context
NEXUS is being built for a 48-hour BuildSprint while also serving as a production-grade engineering foundation for an AI-powered business intelligence platform. We need an architecture that supports:
1. Fast development speed and straightforward local development.
2. Clear separation of concerns between presentation, API, data access, deterministic business calculations, and AI/LLM operations.
3. Preventing vendor lock-in or coupling business logic to external LLM providers or HTTP frameworks.
4. Avoiding microservices complexity during the initial build sprint.

## Decision
We adopt a **Modular Monolith** structure organized into discrete, top-level functional modules:

1. `frontend/`: Independent single-page application (React + TypeScript + Vite).
2. `backend/`: Lightweight FastAPI application serving as the API gateway and orchestrator.
3. `data-layer/`: Isolated persistence layer with distinct models and repository patterns.
4. `recommendation-engine/`: Pure deterministic calculation module independent of web frameworks.
5. `ai-llm-integration/`: Encapsulated AI provider abstraction layer.

## Consequences

### Positive
- **High Cohesion & Low Coupling**: Business logic in `recommendation-engine` can be unit-tested without mock databases or HTTP test clients.
- **Provider Agility**: Changing or upgrading LLM providers only touches `ai-llm-integration/`.
- **Low Operational Overhead**: Single local development workflow with no complex service mesh or inter-service network debugging.
- **Deterministic Trust**: Numerical calculations remain verifiable, eliminating LLM arithmetic hallucinations.

### Negative / Trade-offs
- Requires discipline to prevent developers from bypassing module boundaries (e.g., importing database models directly into route controllers without abstractions).
