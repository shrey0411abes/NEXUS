# ADR 0002: LLM Provider Abstraction & Grounded Business Investigation

## Status
Accepted (Phase 2)

## Context
NEXUS requires natural-language business investigation capabilities so operators can ask questions such as "What should I reorder this week?" and "Why is this product high risk?".

However, integrating Large Language Models into a business operating system presents several engineering and product risks:
1. **Mathematical Hallucination**: LLMs are probabilistic token predictors, not calculators. Delegating revenue summation or stockout calculation directly to an LLM produces unpredictable, fabricated numbers.
2. **Vendor Lock-In**: Tying application services directly to a single provider SDK (e.g. OpenAI or Google Gemini) makes switching models or hosting local inference expensive and disruptive.
3. **Development & CI Bottlenecks**: Requiring live, paid external API keys for local development, automated testing, and CI runs introduces cost, flaky tests, and setup friction.
4. **Unstructured Output**: Free-form natural language responses are brittle and cannot be reliably rendered into structured dashboard UI elements.

## Decision
We implemented a **provider-agnostic LLM abstraction with deterministic grounding** based on the following architectural rules:

1. **Deterministic-First Invariant**:
   The LLM is never the source of truth for numerical business data. All KPIs, velocities, coverage calculations, and risk levels are computed deterministically via SQL and the `recommendation-engine` before the LLM is invoked.

2. **Provider Interface Protocol**:
   Defined `LLMProvider` as a clean, asynchronous Python `Protocol` in `ai-llm-integration/ai_providers/base.py`:
   ```python
   class LLMProvider(Protocol):
       async def generate(self, system_prompt: str, user_prompt: str) -> str:
           ...
   ```
   Neither FastAPI, SQLAlchemy, nor domain analyzers may be imported into the provider layer.

3. **Deterministic Mock Provider**:
   Implemented `MockLLMProvider` as the default development provider (`LLM_PROVIDER=mock`). It returns valid, context-aware structured JSON without calling external APIs, ensuring tests and local development remain zero-cost and 100% reliable.

4. **Isolated Vendor SDK Implementation**:
   Google Gemini support is implemented in `GeminiProvider` inside `ai-llm-integration/ai_providers/gemini_provider.py`. The `google-generativeai` package is imported lazily inside the provider so apps running with `LLM_PROVIDER=mock` require no external credentials or installed SDK dependencies.

5. **Structured Output Contract & Pydantic Validation**:
   The LLM is prompted with strict JSON schema instructions and an anti-hallucination contract. All responses are parsed and validated against `InvestigationResponse` (Pydantic model) in `client.py` before reaching the API layer.

## Consequences

### Positive
- **Zero-Cost Testing**: Complete test suite (80+ unit and integration tests) executes synchronously and deterministically in under 2 seconds without external API calls.
- **Provider Interchangeability**: New providers (e.g., Anthropic, OpenAI, local Ollama) can be added simply by implementing the `LLMProvider` protocol and registering in `client.create_provider()`, with zero changes to FastAPI endpoints or service logic.
- **Zero Numerical Hallucination**: AI explanations are strictly bound to verified facts passed in the prompt context.
- **Robust Failure Modes**: Malformed JSON from LLMs maps to HTTP 502, provider timeouts and unavailability map to HTTP 503, preserving predictable REST contracts.

### Negative / Trade-Offs
- **Context Size Limit**: Extremely large catalogs cannot fit entirely in prompt context and must be pre-filtered by risk and velocity before prompt assembly.
- **Two-Step Processing**: Queries require a deterministic database aggregation step before generating the LLM explanation.
