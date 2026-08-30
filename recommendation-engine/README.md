# NEXUS Recommendation Engine Module

## Purpose
The `recommendation-engine` module encapsulates all pure, deterministic business intelligence, risk scoring, financial calculations, inventory coverage calculations, trend comparisons, and actionable recommendation generation.

## Architectural Principles
1. **Deterministic Calculations**: Numerical analytics, sales velocity, ratio calculations, and risk thresholds are strictly deterministic.
2. **Framework Independence**: This module does not depend on FastAPI or React and can be tested as pure Python business logic.
3. **Foundation for AI Context**: Verified metrics produced by this module provide the factual grounding for downstream AI/LLM explanations.

## Module Structure
```
recommendation-engine/
├── analyzers/
│   ├── sales_analyzer.py        # SQL-aggregated revenue, volume, and velocity
│   ├── inventory_analyzer.py    # Stock coverage and risk evaluations
│   └── trend_analyzer.py        # Contiguous window demand trends and anomaly detection
├── calculators/
│   ├── kpi_calculator.py        # Core KPI math & safe arithmetic
│   ├── velocity_calculator.py   # Product sales velocity formulas
│   ├── coverage_calculator.py   # Days of inventory coverage & status classifiers
│   └── risk_calculator.py       # Deterministic stockout risk heuristics
├── analytics_models.py          # Pydantic schemas for calculated analytics outputs
├── correlation_models.py        # Pydantic schemas for cross-domain correlations & priority queue
├── cross_domain_engine.py       # Deterministic cross-domain correlation & priority queue engine (Phase 3A/3B)
└── engine.py                    # Structured recommendation generation orchestrator
```

## Status: Phase 3B (Complete)
- **Implemented Capabilities**:
  - Full suite of deterministic business KPIs, product sales velocity, inventory coverage days, stockout risk scoring, demand trend comparisons, and structured rule-based recommendations.
  - **Phase 3A Cross-Domain Correlation Engine**: Deterministically identifies multi-domain friction (e.g. `SURGE_STOCKOUT_SQUEEZE`, `ACCELERATING_DEPLETION`, `DEAD_STOCK_CAPITAL_TRAP`).
  - **Phase 3B Operational Risk Prioritization Engine**: Ranks active operational risks [1..N] with explainable composite scoring [0-100] answering *"What requires attention now, and why?"*.

