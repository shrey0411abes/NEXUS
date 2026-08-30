# NEXUS — Engineering Learning Framework

## Overview
This directory serves as the dedicated knowledge base for technical concepts, architectural patterns, algorithms, and engineering insights investigated and applied throughout the development of NEXUS.

## Purpose & Protocol
To maintain high technical rigor and clear engineering documentation:
1. **Document Upon Study**: Concepts are documented here only when they are actively investigated, evaluated, or implemented in the codebase.
2. **Format for Notes**:
   - **Definition**: What the concept is.
   - **Why It Matters**: Business and engineering importance.
   - **NEXUS Implementation**: Where and how it lives in the codebase.
   - **Small Code Example**: Minimal idiomatic snippet.
   - **Common Mistakes**: Pitfalls and anti-patterns to avoid.
   - **Practical Exercise**: Hands-on verification scenario.

---

## Studied & Applied Concepts (Phase 2: AI/LLM Integration & Natural-Language Investigation)

### 1. LLM Provider Abstraction
- **Definition**: Defining a vendor-neutral protocol/interface for Large Language Model generation so the core business logic never directly imports or depends on a specific provider SDK (e.g. OpenAI, Google Gemini, Anthropic).
- **Why It Matters**: Prevents vendor lock-in, allows zero-cost local testing via mock providers, and enables changing models or hosting local inference without touching application logic.
- **NEXUS Implementation**: `ai-llm-integration/ai_providers/base.py` (`LLMProvider` Protocol), `ai_providers/mock_provider.py`, `ai_providers/gemini_provider.py`, and `client.py` (`create_provider()` factory).
- **Small Code Example**:
  ```python
  from typing import Protocol, runtime_checkable

  @runtime_checkable
  class LLMProvider(Protocol):
      async def generate(self, system_prompt: str, user_prompt: str) -> str:
          ...
  ```
- **Common Mistakes**: Hard-coding provider-specific SDK imports (`import google.generativeai`) inside business service layers or API endpoint routes.
- **Practical Exercise**: Switch `LLM_PROVIDER=mock` in `.env` and verify all tests pass without network access or API keys.

---

### 2. Structured LLM Output
- **Definition**: Constraining the model to produce machine-readable structured JSON adhering to an exact schema, rather than unstructured natural language text.
- **Why It Matters**: Unstructured text cannot be safely parsed by frontend dashboards to render separate badges, lists, risk levels, and confidence scores.
- **NEXUS Implementation**: System prompt in `ai-llm-integration/ai_context/business_context.py` enforcing JSON-only output; validation in `client.py` using `InvestigationResponse`.
- **Small Code Example**:
  ```python
  # System prompt schema constraint
  SYSTEM_PROMPT = """Return ONLY valid JSON matching:
  {"answer": str, "key_findings": list[str], "confidence": "HIGH"|"MEDIUM"|"LOW"}
  """
  ```
- **Common Mistakes**: Assuming an LLM will always output valid JSON without stripping markdown fences (```` ```json ````) or handling syntax errors.
- **Practical Exercise**: Pass invalid JSON text to `invoke_investigation()` and assert `MalformedLLMOutputError` is raised.

---

### 3. Pydantic Schema Validation
- **Definition**: Runtime type checking and structural validation for incoming requests and outgoing LLM responses using Pydantic models.
- **Why It Matters**: Guarantees that malformed inputs (e.g. negative business IDs, blank questions) are rejected at the gateway (HTTP 422), and that malformed LLM responses are intercepted before reaching the client.
- **NEXUS Implementation**: `ai-llm-integration/ai_schemas/request.py` (`InvestigationRequest`) and `ai_schemas/response.py` (`InvestigationResponse`).
- **Small Code Example**:
  ```python
  from pydantic import BaseModel, Field, field_validator

  class InvestigationRequest(BaseModel):
      business_id: int = Field(..., gt=0)
      question: str = Field(..., min_length=3, max_length=500)

      @field_validator("question", mode="before")
      @classmethod
      def clean(cls, v: str) -> str:
          return v.strip()
  ```
- **Common Mistakes**: Allowing raw unvalidated dictionaries to flow between the LLM provider and the API response.
- **Practical Exercise**: Attempt creating `InvestigationRequest(business_id=-1, question=" ")` and confirm validation fails.

---

### 4. Prompt Grounding
- **Definition**: Supplying the LLM with explicit, pre-calculated, verified business facts directly within the context window before asking it to answer a question.
- **Why It Matters**: LLMs have no access to private business databases and will hallucinate plausible-sounding metrics unless supplied with ground-truth data in the prompt.
- **NEXUS Implementation**: `ai-llm-integration/ai_context/business_context.py` aggregates verified KPIs, inventory risks, trends, and rule-based advisories into the `user_prompt`.
- **Small Code Example**:
  ```python
  user_prompt = f"""--- VERIFIED BUSINESS CONTEXT ---
  Revenue: ${kpis.total_revenue:,.2f}
  Low Stock SKUs: {kpis.low_stock_products_count}
  --- QUESTION ---
  {question}"""
  ```
- **Common Mistakes**: Sending user queries directly to an LLM without contextual business data and expecting accurate answers.
- **Practical Exercise**: Run an investigation on a newly seeded business and verify the generated answer quotes exact numbers from the database.

---

### 5. Hallucination Control
- **Definition**: Systematic prompt engineering and architectural techniques that strictly prevent the model from inventing numbers, dates, or business conclusions.
- **Why It Matters**: In business intelligence, a single fabricated inventory number or revenue calculation can lead to catastrophic operational decisions (e.g., missed reorders).
- **NEXUS Implementation**: Anti-hallucination contract in `SYSTEM_PROMPT_TEMPLATE` (`ai_context/business_context.py`) explicitly forbidding invention of numbers and enforcing that deterministic analytics are the sole authority.
- **Small Code Example**:
  ```python
  ANTI_HALLUCINATION_RULES = """
  1. Reason ONLY from supplied verified facts.
  2. DO NOT invent revenue, quantities, or risk levels.
  3. Deterministic analytics are the SOLE authoritative source of truth.
  4. If data is insufficient, state it explicitly in limitations.
  """
  ```
- **Common Mistakes**: Asking the LLM to calculate mathematical sums (e.g., "Add up the revenue for these 50 transactions") instead of doing it in SQL.
- **Practical Exercise**: Test prompt behavior when no KPI data is available; verify confidence is set to LOW and limitations document missing data.

---

### 6. AI Context Construction
- **Definition**: The process of selecting, formatting, and compressing domain entity states into a token-efficient text representation for LLM ingestion.
- **Why It Matters**: Prevents token limit overflows, reduces latency and API costs, and optimizes prompt signal-to-noise ratio.
- **NEXUS Implementation**: `build_business_context_prompt()` in `ai-llm-integration/ai_context/business_context.py` formats executive KPIs, top stockout risks, demand momentum, and rule-based advisories into markdown sections.
- **Small Code Example**:
  ```python
  def build_business_context_prompt(business_name, kpis, risk_indicators, ...):
      sections = [f"### BUSINESS: {business_name}"]
      if kpis:
          sections.append(f"- Revenue: ${kpis.total_revenue:,.2f}")
      return "\n".join(sections)
  ```
- **Common Mistakes**: Dumping raw database table dumps (JSON dumps of thousands of rows) into the prompt context.
- **Practical Exercise**: Verify that `build_business_context_prompt()` handles empty risk indicators and zero-transaction businesses gracefully without crashing.

---

### 7. Provider / API Failure Handling
- **Definition**: Isolating third-party external service errors (network timeouts, rate limits, provider downtime, bad JSON) and mapping them to appropriate HTTP error codes without leaking internal secrets.
- **Why It Matters**: Prevents third-party outages from crashing the entire FastAPI backend and protects sensitive API keys from appearing in server logs or error traces.
- **NEXUS Implementation**: `ai-llm-integration/exceptions.py` hierarchy; exception mapping in `backend/app/api/v1/endpoints/investigations.py` (502 for malformed LLM JSON, 503 for timeout/provider outage, 404 for missing business).
- **Small Code Example**:
  ```python
  try:
      return await run_business_investigation(...)
  except LLMTimeoutError:
      raise HTTPException(status_code=503, detail="AI provider timed out. Please retry.")
  except MalformedLLMOutputError:
      raise HTTPException(status_code=502, detail="AI provider returned an unexpected format.")
  ```
- **Common Mistakes**: Catching all exceptions with a bare `except:` and returning generic 500 errors or leaking stack traces containing API keys.
- **Practical Exercise**: Inject a failing mock provider and confirm the endpoint returns HTTP 503 rather than an unhandled 500 error.

---

### 8. Deterministic Systems vs Probabilistic Systems
- **Definition**:
  - **Deterministic Systems**: Produce the exact same mathematical output every time for a given input (SQL aggregations, risk formulas, rule engines).
  - **Probabilistic Systems**: Produce statistically likely token distributions with non-zero variance (LLMs, neural networks).
- **Why It Matters**: Architecture must strictly assign calculation tasks to deterministic systems and interpretation/natural-language tasks to probabilistic systems.
- **NEXUS Implementation**:
  ```
  Database -> Deterministic Analytics Engine -> Verified Facts -> LLM (Explanation Only)
  ```
- **Common Mistakes**: Expecting an LLM to compute $12,450.50 + 3,210.75$ reliably across multiple prompt calls.
- **Practical Exercise**: Compare the output of `SalesAnalyzer.get_business_kpis()` (guaranteed identical) with LLM explanations across multiple calls.

---

### 9. Separation of Concerns
- **Definition**: Structuring software into distinct sections, where each section addresses a separate operational concern (presentation, routing, domain computation, persistence, AI interpretation).
- **Why It Matters**: Prevents monolithic entanglement, makes unit testing straightforward, and allows modifying AI prompts without touching database schemas or vice versa.
- **NEXUS Implementation**:
  - `frontend/`: UI rendering & state.
  - `backend/app/api/`: Request validation & HTTP routing.
  - `data-layer/`: Persistence & SQLAlchemy ORM.
  - `recommendation-engine/`: Deterministic business intelligence.
  - `ai-llm-integration/`: AI provider abstraction & prompt synthesis.
- **Common Mistakes**: Writing database queries or LLM SDK calls directly inside React components or FastAPI route functions.
- **Practical Exercise**: Verify that `ai-llm-integration/` contains zero imports from `fastapi` or `sqlalchemy`.

---

### 10. Dependency Inversion
- **Definition**: High-level modules should not depend on low-level modules; both should depend on abstractions (interfaces or protocols).
- **Why It Matters**: Decouples the investigation service from specific AI SDKs (e.g. `google-generativeai`), making the system modular and testable with mock providers.
- **NEXUS Implementation**: `investigation_service.py` accepts any object conforming to `LLMProvider` protocol rather than instantiating `GeminiProvider` directly.
- **Small Code Example**:
  ```python
  # High-level service depends on abstraction:
  async def run_business_investigation(db: Session, provider: LLMProvider, ...):
      return await invoke_investigation(provider=provider, ...)
  ```
- **Common Mistakes**: Instantiating concrete third-party SDK clients inside domain service constructors.
- **Practical Exercise**: Pass a custom in-memory mock provider to `run_business_investigation()` in unit tests without configuring environment variables.

---

## Studied & Applied Concepts (Phase 1B: Deterministic Analytics & Business Intelligence)

### 11. KPI Design
- **Definition**: Quantifiable measures used to evaluate the overall operational and financial health of a business.
- **NEXUS Reference**: `recommendation-engine/calculators/kpi_calculator.py`

### 12. SQL Aggregations & Grouping
- **Definition**: In-engine database aggregation (`SUM`, `COUNT`, `AVG`, `GROUP BY`) to eliminate loading thousands of rows into application memory.
- **NEXUS Reference**: `recommendation-engine/analyzers/sales_analyzer.py`

### 13. Sales Velocity & Inventory Coverage
- **Definition**: Sales rate per day ($\text{units}/\text{day}$) and estimated days until stockout ($\text{qty}/\text{velocity}$).
- **NEXUS Reference**: `recommendation-engine/calculators/velocity_calculator.py`, `coverage_calculator.py`

### 14. Stockout Risk Heuristics & Deterministic Recommendations
- **Definition**: Multi-tier rule-based risk classification and prioritized operational advisories.
- **NEXUS Reference**: `recommendation-engine/calculators/risk_calculator.py`, `engine.py`

---

## Studied in Phase 1A & Phase 0
*(Relational Databases, 3NF, Primary Keys, Foreign Keys, SQLAlchemy 2.0, Repository Pattern, SQLite Pragmas, Modular Monolith)*
