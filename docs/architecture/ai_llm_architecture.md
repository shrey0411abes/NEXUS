# NEXUS AI/LLM Integration Architecture

> **M3-S3 — AI Output Hardening & Deterministic Confidence Calibration**
>
> M3-S3 validates and sanitizes the structure and safety boundary of LLM-generated responses,
> binds authoritative request context, and deterministically constrains confidence.
> Deterministic business facts are supplied as grounded context to the LLM, but generated
> natural-language claims are not independently fact-checked against source metrics in this milestone.
>
> **M3-S4 — Deterministic Factual Claim Verification & Grounded Response Integrity**
>
> M3-S4 adds a post-generation, deterministic claim verification boundary. Numerical claims
> extracted from the LLM-generated response are compared against the verified business facts
> already produced by the analytics pipeline. Claims that conflict with deterministic facts reduce
> confidence. Claims that cannot be reliably mapped to a known fact are classified as UNVERIFIED
> rather than silently accepted. No LLM call, no database query, and no external dependency is
> introduced by the verifier.

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
        M3-S3: Output schema hardening, Unicode sanitization,
        authoritative question binding, deterministic confidence
        calibration (does NOT fact-check generated text)
                    │
                    ▼
        M3-S4: Deterministic factual claim verification
        [extract numeric claims → compare against verified facts
         VERIFIED / CONFLICTING / UNVERIFIED → downgrade confidence
         on conflict; no LLM call, no DB query]
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

---

## 10. Implementation Status: Post-Generation Factual Claim Verification

> **This item has been implemented as M3-S4.** See Section 11 below.

---

## 11. M3-S4 — Deterministic Factual Claim Verification

### Scope

M3-S4 adds a post-generation deterministic verification boundary in `claim_verifier.py`.

### What M3-S4 does

- Extracts numeric values from the LLM-generated `answer` and `supporting_facts`.
- Enforces deterministic metric-aware association: numeric claims are compared only against
  deterministic facts whose canonical metric aliases are explicitly matched in the claim text.
  Numeric proximity to unrelated metrics is insufficient for verification or conflict classification.
- Compares each extracted value against eligible deterministic facts in the `VerificationContext`
  built from already-computed `BusinessKPIs` and `BusinessFinancialSummary`.
- Classifies each claim as `VERIFIED`, `CONFLICTING`, or `UNVERIFIED`.
- Applies a conservative confidence-downgrade policy: any `CONFLICTING` claim prevents
  `HIGH` confidence and appends a limitation note. Confidence can only decrease or remain unchanged.

### What M3-S4 does NOT do

- Does **not** call any LLM.
- Does **not** make any database queries.
- Does **not** introduce external dependencies.
- Does **not** use RAG, embeddings, vector databases, or web search.
- Does **not** provide general semantic or NLP-based fact-checking.
- Claims that cannot be deterministically mapped to an eligible known fact remain `UNVERIFIED`
  rather than being guessed.

### Classification Rules

| Situation | Classification |
|---|---|
| Claim has matching metric alias and extracted value matches known fact within 1% | `VERIFIED` |
| Claim has matching metric alias and extracted value is within 5× but outside tolerance | `CONFLICTING` |
| Claim has matching metric alias but value is > 5× from known fact | `UNVERIFIED` |
| No metric alias in claim text matches known deterministic facts (unknown metric) | `UNVERIFIED` |
| No deterministic facts available in verification context | All claims `UNVERIFIED` |

### Confidence Policy

| Verification Result | Effect on Confidence |
|---|---|
| `CONFLICTING` present | Downgrade `HIGH` → `MEDIUM`; append limitation note |
| `UNVERIFIED` only (no conflict) | No change |
| `VERIFIED` only | No change (confidence cannot be raised by verifier) |

### New Files

- **[NEW]** `ai-llm-integration/claim_verifier.py` — pure-Python verifier, no external deps
- **[NEW]** `tests/ai/test_claim_verifier.py` — 48 focused M3-S4 tests

### Modified Files

- `backend/app/services/investigation_service.py` — M3-S4 verification step inserted after M3-S3 confidence calibration
