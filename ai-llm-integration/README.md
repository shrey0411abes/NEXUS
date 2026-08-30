# NEXUS AI/LLM Integration Module

## Purpose
The `ai-llm-integration` module provides a vendor-agnostic abstraction layer for Large Language Model (LLM) providers, context prompt engineering, anti-hallucination guardrails, and natural-language business investigation grounded in deterministic analytics.

---

## Architectural Principles

1. **Deterministic Grounding First**:
   ```
   DATABASE -> DETERMINISTIC ANALYTICS -> VERIFIED FACTS -> AI / LLM (Explanation Only)
   ```
   The LLM never calculates business numbers; it interprets pre-verified metrics.

2. **Isolated Provider Boundaries**:
   All vendor SDKs (e.g. `google-generativeai`) are encapsulated inside `ai_providers/`. The investigation service depends strictly on the `LLMProvider` protocol.

3. **Structured Outputs & Schema Validation**:
   Responses are validated via Pydantic (`InvestigationResponse`) before returning to callers. Malformed JSON raises controlled application errors.

4. **Zero-Credential Development**:
   Includes a deterministic `MockLLMProvider` (`LLM_PROVIDER=mock`) that runs without external API calls, enabling fast, free local testing and CI.

---

## Module Layout

```
ai-llm-integration/
├── __init__.py              # Package entrypoint and exports
├── README.md                # Module documentation
├── client.py                # Provider factory & response validation
├── exceptions.py            # AIIntegrationError hierarchy
├── investigation_service.py # End-to-end investigation pipeline orchestrator
├── ai_context/
│   ├── __init__.py
│   └── business_context.py  # Factual prompt builder & anti-hallucination contract
├── ai_providers/
│   ├── __init__.py
│   ├── base.py              # LLMProvider Protocol
│   ├── mock_provider.py     # Deterministic Mock Provider (default)
│   └── gemini_provider.py   # Google Gemini Provider
└── ai_schemas/
    ├── __init__.py
    ├── request.py           # InvestigationRequest (Pydantic)
    └── response.py          # InvestigationResponse (Pydantic)
```

---

## Status: Phase 2 (Currently Implemented)

- **Currently Implemented**:
  - `LLMProvider` Protocol & `MockLLMProvider`
  - `GeminiProvider` (Google Gemini 1.5/2.0 support)
  - `InvestigationRequest` & `InvestigationResponse` schemas
  - `build_business_context_prompt()` with Anti-Hallucination system contract
  - `run_business_investigation()` orchestrator
  - `POST /api/v1/investigations` FastAPI endpoint
  - React `BusinessInvestigation` component
- **Planned for Phase 3**:
  - Cross-domain multi-signal correlation
  - Anomaly graph context integration
- **Future Scope (Not in Phase 2)**:
  - Vector databases, embeddings, and RAG pipelines
  - Multi-agent frameworks (LangChain, LangGraph, CrewAI)
  - Persistent conversational memory
