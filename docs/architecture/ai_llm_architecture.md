# NEXUS AI/LLM Integration Architecture

## 1. Design Principle

The core invariant of Phase 2:

```
SOURCE OF TRUTH
      │
      ▼
   DATABASE
      │
      ▼
DETERMINISTIC ANALYTICS
      │
      ▼
VERIFIED BUSINESS FACTS
      │
      ▼
   AI / LLM
      │
      ▼
INTERPRETATION + EXPLANATION
```

The LLM **explains** verified business data. It does not **invent** business data.

---

## 2. Module Structure

```
ai-llm-integration/
├── __init__.py              # Package exports
├── README.md                # Module documentation
├── client.py                # Provider factory + response validator
├── exceptions.py            # AIIntegrationError hierarchy
├── investigation_service.py # Orchestration: analytics → context → provider → response
├── ai_context/
│   ├── __init__.py
│   └── business_context.py  # Deterministic analytics → structured AI context + system prompt
├── ai_providers/
│   ├── __init__.py
│   ├── base.py              # LLMProvider Protocol (provider-agnostic interface)
│   ├── mock_provider.py     # Deterministic mock (no API key required)
│   └── gemini_provider.py   # Google Gemini provider (requires LLM_API_KEY)
└── ai_schemas/
    ├── __init__.py
    ├── request.py           # InvestigationRequest (Pydantic)
    └── response.py          # InvestigationResponse (Pydantic)
```

### Why `ai_` prefixes on subdirectories?

The `data-layer/schemas/` package already occupies the `schemas` namespace in `sys.path`. To prevent
namespace collision, all AI-specific subpackages use the `ai_` prefix (`ai_schemas`, `ai_providers`, `ai_context`).

---

## 3. Investigation Pipeline

```
POST /api/v1/investigations
        │
        ▼
InvestigationRequest (Pydantic validation)
        │
        ▼
Verify business exists → 404 if not found
        │
        ▼
run_business_investigation()
        │
    ┌───┴───────────────────────────┐
    ▼                               ▼
SalesAnalyzer(db)           InventoryAnalyzer(db)
.get_business_kpis()        .get_stock_risk_indicators()
    │                               │
    └───────────────┬───────────────┘
                    ▼
             TrendAnalyzer(db)
             .get_demand_trends()
                    │
                    ▼
            RecommendationEngine(db)
            .generate_recommendations()
                    │
                    ▼
     build_business_context_prompt()
     [Verified facts → structured context + system prompt]
                    │
                    ▼
         provider.generate(system_prompt, user_prompt)
         [LLMProvider Protocol — no direct SDK calls]
                    │
                    ▼
        invoke_investigation() validates raw output
        [JSON parse → Pydantic InvestigationResponse]
                    │
                    ▼
         Return InvestigationResponse to FastAPI
                    │
                    ▼
      JSON HTTP 200 to frontend
```

---

## 4. Provider Abstraction

The `LLMProvider` is a `typing.Protocol` (`runtime_checkable`):

```python
class LLMProvider(Protocol):
    async def generate(self, system_prompt: str, user_prompt: str) -> str: ...
```

Provider selection happens **only** in `client.create_provider()`. The investigation service, API endpoint,
and context builder depend on this abstraction — never on a concrete class.

### Adding a new provider

1. Create `ai-llm-integration/ai_providers/openai_provider.py` implementing `generate()`.
2. Add a new `elif provider_name == "openai":` branch in `client.create_provider()`.
3. No changes to `investigation_service.py`, `investigations.py`, or any test fixtures required.

---

## 5. Anti-Hallucination Contract

The system prompt in `ai_context/business_context.py` establishes an explicit contract:

```
CRITICAL CONSTRAINTS (ANTI-HALLUCINATION CONTRACT):
1. Reason ONLY from the verified business facts supplied in the context.
2. DO NOT invent: revenue, transactions, quantities, risk levels, recommendations.
3. Deterministic analytics are the SOLE authoritative source of truth for numbers.
4. If data is insufficient, explicitly state it in "limitations" and "answer".
5. Return ONLY valid JSON matching the exact schema.
```

### Why LLM is not authoritative

| Data Type | Source | LLM Role |
|---|---|---|
| Revenue | SQL aggregation | Explain trends |
| Inventory risk | Deterministic risk engine | Describe implications |
| Sales velocity | Mathematical calculation | Interpret for operator |
| Recommendations | Rule-based engine | Elaborate reasoning |
| Demand trends | Statistical comparison | Contextualize |

---

## 6. Error Handling

| Scenario | HTTP Status | Source |
|---|---|---|
| Business not found | 404 | Endpoint |
| Invalid request | 422 | Pydantic (FastAPI auto) |
| Provider not configured | 503 | Endpoint |
| LLM timeout | 503 | LLMTimeoutError |
| LLM provider failure | 503 | LLMProviderError |
| Malformed LLM output | 502 | MalformedLLMOutputError |
| Unexpected error | 500 | Endpoint catch-all |

---

## 7. Environment Configuration

```env
# Default: mock mode — no API key needed
LLM_PROVIDER=mock

# For Google Gemini
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_API_KEY=<your-api-key>

# Provider response timeout
LLM_TIMEOUT_SECONDS=30.0
```

---

## 8. Phase 2 Limitations

- **No RAG or vector database** — context is always fresh from live database queries.
- **No conversational memory** — each investigation is stateless.
- **Single provider active at a time** — selected via `LLM_PROVIDER` env.
- **Context window bounded** — extremely large catalogs may truncate to highest-risk items.
- **Probabilistic output** — LLM responses are not deterministic even with identical context.
- **No streaming** — response is delivered as a single JSON payload.

---

## 9. Phase 3 Recommendations

In priority order:

1. **Business selector on frontend** — let user pick active business context in investigation UI.
2. **Investigation history** — persist queries and responses in a new `investigations` table.
3. **Context caching** — cache deterministic analytics context for 5 minutes to reduce DB load per question.
4. **Additional providers** — OpenAI, Anthropic, local Ollama.
5. **Structured anomaly detection** — feed anomaly signals from `TrendAnalyzer.get_daily_sales_anomalies()` into context.
