# NEXUS Analytics Architecture & Deterministic Intelligence Specification

## 1. Executive Summary

NEXUS enforces a core architectural invariant: **The Large Language Model (LLM) is never the source of truth for business calculations or numerical metrics.** All business Key Performance Indicators (KPIs), product sales velocities, inventory coverage timelines, demand trends, and stockout risk indicators are computed **deterministically** through SQL aggregations and mathematical formulas before any downstream contextual AI reasoning takes place.

---

## 2. Analytics Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Database Source of Truth (SQLite)              │
│       transactions • transaction_items • inventories        │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               │ SQL Aggregation (SUM, COUNT) │ Joined Queries
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│        SalesAnalyzer         │ │      InventoryAnalyzer     │
│  Revenue • ATV • Velocities  │ │  Stock Status • Coverage   │
└──────────────┬───────────────┘ └────────────┬───────────────┘
               │                              │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │        TrendAnalyzer         │
               │ Time-Window Trends • Z-Score │
               └──────────────┬───────────────┘
                              │ Verified Metrics
                              ▼
               ┌──────────────────────────────┐
               │    RecommendationEngine      │
               │  Deterministic Rule Matching │
               │  Prioritized Recommendations │
               └──────────────┬───────────────┘
                              │ Typed Schemas (Pydantic)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 FastAPI Analytics Endpoints                 │
│              /analytics/kpis • /recommendations             │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Frontend Dashboard      │ │     Future AI/LLM Layer    │
│   React Real-Time Metrics    │ │   Natural-Language Q&A     │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 3. Mathematical Formulas & Logic

### 3.1 Total Revenue & Average Transaction Value (ATV)
- **Total Revenue**:
  $$\text{Revenue} = \sum (\text{item.quantity} \times \text{item.unit\_price}) \quad \forall \; \text{sale transactions in window}$$
- **Average Transaction Value**:
  $$\text{ATV} = \begin{cases} \frac{\text{Total Revenue}}{\text{Total Transactions}}, & \text{if } \text{Total Transactions} > 0 \\ 0.0, & \text{otherwise} \end{cases}$$

### 3.2 Product Sales Velocity
$$\text{Sales Velocity (units/day)} = \frac{\text{Units Sold in Window}}{\text{Observation Window (days)}}$$
- **Default Observation Window**: 30 days (configurable via API query parameter `days`).
- **Zero Handling**: If 0 units sold, velocity is explicitly $0.0000$.

### 3.3 Inventory Coverage (Days of Inventory)
$$\text{Days of Inventory} = \begin{cases} 0.0, & \text{if } \text{Quantity} \le 0 \\ \frac{\text{Current Quantity}}{\text{Sales Velocity}}, & \text{if } \text{Sales Velocity} > 0 \\ \text{None (Undefined / No Sales Velocity)}, & \text{if } \text{Sales Velocity} = 0 \end{cases}$$

### 3.4 Deterministic Stockout Risk Heuristics
| Risk Level | Trigger Conditions | Actionable Severity |
| :--- | :--- | :--- |
| **CRITICAL** | $\text{Quantity} \le 0$ OR $\text{Days of Inventory} \le 2.0\text{ days}$ | Immediate stockout emergency |
| **HIGH** | $\text{Days of Inventory} \le 7.0\text{ days}$ OR ($\text{Quantity} \le \text{Reorder Level} \land \text{Velocity} > 0$) | Plan replenishment within 48h |
| **MEDIUM** | $\text{Days of Inventory} \le 14.0\text{ days}$ OR $\text{Quantity} \le \text{Reorder Level}$ | Normal reorder cycle |
| **LOW** | $\text{Days of Inventory} > 14.0\text{ days} \land \text{Quantity} > \text{Reorder Level}$ | Healthy stock buffer |

### 3.5 Demand Trend Classification
Compares average daily sales across two contiguous windows (e.g. recent 14 days vs prior 14 days):
$$\text{Percentage Change} = \frac{\text{Recent Daily Avg} - \text{Prior Daily Avg}}{\text{Prior Daily Avg}}$$
- **INCREASING**: $\text{Percentage Change} > +5\%$ (or recent $>0$ when prior $=0$).
- **DECREASING**: $\text{Percentage Change} < -5\%$.
- **STABLE**: $|\text{Percentage Change}| \le 5\%$.

---

## 4. Architectural Boundaries & Decisions

1. **Database vs Python Processing**:
   - Aggregate statistics (sums, counts, product-level sales totals) are computed inside SQLite via SQL functions (`func.sum`, `func.count`, `func.coalesce`).
   - Domain heuristics (risk level evaluation, status classification, trend categorization) are computed in pure Python classes.
2. **Framework Independence**:
   - `recommendation-engine` has zero dependency on FastAPI or HTTP request contexts. It accepts SQLAlchemy `Session` objects and returns typed Pydantic analytics models.
3. **Timezone Policy**:
   - All time-window cutoffs are evaluated in UTC (`datetime.now(timezone.utc)`).

---

## 5. Limitations & Future Scalability

- **Lead-Time Information**: The current schema does not include supplier purchase lead times; stockout risk therefore utilizes velocity-based days-of-inventory thresholds ($2\text{d}, 7\text{d}, 14\text{d}$).
- **PostgreSQL Scaling**: The SQL aggregations in `SalesAnalyzer` and `TrendAnalyzer` map directly to standard SQL and will execute with high efficiency using PostgreSQL date indexing and partitioning.
