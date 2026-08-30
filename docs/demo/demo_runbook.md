# NEXUS — End-to-End Hackathon Demo Runbook

This runbook describes the shortest, most reliable demonstration flow for the **NEXUS AI Business Operating System**.

---

## 1. Quickstart Environment Setup

### Terminal 1 — Backend (FastAPI)
```powershell
# From project root: C:\Users\shrey\NEXUS
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
*Backend initializes at `http://localhost:8000`. Health telemetry accessible at `http://localhost:8000/health`.*

### Terminal 2 — Seed Deterministic Demo Data
```powershell
# Run the standalone database seed script
python scripts/seed_demo_data.py
```
*Creates `Apex Electronics` with a rich 5-SKU catalog and 30 days of realistic sales transactions.*

### Terminal 3 — Frontend (React / Vite)
```powershell
cd frontend
npm run dev
```
*Frontend opens at `http://localhost:5173`.*

---

## 2. Step-by-Step 10-Point Demonstration Flow

### Step 1: Backend Health & System Architecture
- Open `http://localhost:5173`.
- Point out the **Backend Connection: Connected** indicator at the top.
- Explain the non-negotiable core architectural invariant:
  > `SQLITE SOURCE OF TRUTH → DETERMINISTIC ANALYTICS → VERIFIED BUSINESS FACTS → CROSS-DOMAIN CORRELATIONS → OPERATIONAL RISK PRIORITIZATION → FINANCIAL EXPOSURE → AI INTERPRETATION`

### Step 2: Synchronized Business Selection & Time Horizon
- Select **Apex Electronics (Consumer Tech & Accessories)** from the Business dropdown.
- Select the **Last 30 Days** observation window.
- Point out how all three command center panels synchronize in real-time.

### Step 3: Executive Key Performance Indicators (KPIs)
- Highlight the deterministic executive KPI cards:
  - Total Sales Revenue: ~$6,500+
  - Total Completed Transactions
  - Average Transaction Value (ATV)
  - Active Catalog SKUs & Low Stock / Out of Stock counts.

### Step 4: Inventory Coverage & Stockout Risk Matrix
- Review the **Stockout Risk & Coverage Matrix**:
  - `Ultra-light Wireless Mouse` (SKU: `MS-WIRELESS-PRO`) flagged as **CRITICAL** (0 units on hand).
  - `Braided USB-C Cable (2m)` (SKU: `CBL-USBC-2M`) flagged as **HIGH** (only 8 units left, below reorder threshold of 25).

### Step 5: Demand Momentum & Volume Anomaly Flags
- Review the **Demand Trend Momentum** panel:
  - `ANC Wireless Headphones` (SKU: `AUD-ANC-PRO`) shows strong **INCREASING** momentum (+100% surge in recent 10 days).

### Step 6: Phase 3A Cross-Domain Risk Correlation
- Scroll to the **Cross-Domain Intelligence & Risk Correlations** panel:
  - Demonstrate multi-signal collisions:
    - `SURGE_STOCKOUT_SQUEEZE` (CRITICAL): Surging demand momentum colliding with stockout pressure.
    - `DEAD_STOCK_CAPITAL_TRAP` (MEDIUM): 120 units of `Legacy VGA to DVI Adapter` with 0 sales velocity.

### Step 7: Phase 3B Operational Risk Prioritization Queue
- Review the prioritized queue ranked **[1..N]** with deterministic priority scores (0 to 100):
  - Shows operator exactly: **"What requires attention now, and why?"**
  - Displays verified supporting facts, business impact, and direct recommended action.

### Step 8: Phase 4A Financial Impact & Revenue Exposure
- Scroll to the **Financial Impact & Revenue Exposure** panel:
  - **Daily Revenue Exposure ($/day):** Immediate revenue run-rate exposed during stockout.
  - **7-Day & 30-Day Projected Revenue Exposure ($):** Cumulative exposure if replenishment is delayed.
  - **Trapped Retail Inventory Value ($):** Exact retail dollar valuation locked in stagnant dead stock.
  - Disclaimers explicitly clarify that projections represent exposed sales, not guaranteed losses, and that unit cost is not fabricated.

### Step 9: Natural-Language Business Investigation (AI)
- Scroll to the **AI Business Investigation Assistant**.
- Submit a natural-language business question, for example:
  > *"What are my biggest operational and financial risks this week, and what should I reorder first?"*

### Step 10: Grounded AI Interpretation (Anti-Hallucination)
- Observe the structured JSON response:
  - **Answer:** Direct, plain-language business explanation.
  - **Key Findings:** Derived strictly from the verified analytics.
  - **Actionable Recommendations:** Grounded in real inventory levels.
  - **Supporting Facts:** Exact numbers from SQLite.
  - **Confidence & Limitations:** Transparently stated.
- Emphasize: **The LLM did not calculate arithmetic or invent business data — it interpreted verified deterministic facts.**
