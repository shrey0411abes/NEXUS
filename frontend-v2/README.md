# NEXUS Frontend — React + Vite

Multi-page command-center UI with sidebar navigation, built on the NEXUS
design system (IBM Plex Sans/Mono, ink/paper palette, state-colored risk
pills).

## Run it

```
cd nexus-frontend
npm install
npm run dev
```

Opens at http://localhost:5173.

## Pages

- **Dashboard** (`/`) — KPI overview, inventory trend chart, top risks, AI
  assistant teaser.
- **Risk actions** (`/risk-queue`) — Active / Resolved / Audit history tabs,
  action modal (Acknowledge / Resolve / Dismiss) matching the real
  `POST /api/v1/cross-domain/actions` lifecycle.
- **Inventory** (`/inventory`) — stock levels vs. reorder thresholds.
- **Transactions** (`/transactions`) — POS/transaction history.
- **Investigations** (`/investigations`) — AI chat console.
- **Financial impact** (`/financial`) — exposure, supplier risk, distribution.

## Wiring to the real backend

Everything currently reads from `src/data/mockData.js`. To connect it to
your actual NEXUS API:

1. Add an `src/api.js` client mirroring `frontend/src/services/api.ts` from
   the main repo (`fetch` wrapper with JWT auth header, base URL from env).
2. Replace the `mockData` imports in each page with `useEffect` + `fetch`
   calls to the matching endpoint:
   - Dashboard → `GET /api/v1/analytics/kpis`, `GET /api/v1/cross-domain/priorities`
   - RiskQueue → `GET /api/v1/cross-domain/priorities?include_resolved=`,
     `GET /api/v1/cross-domain/actions`, `POST /api/v1/cross-domain/actions`
   - Inventory → `GET /api/v1/inventory`
   - Transactions → `GET /api/v1/transactions`
   - Financial → `GET /api/v1/financial/impact`, `GET /api/v1/financial/summary`
3. `ActionModal`'s `onSubmit` already isolates the "record action" step from
   any inventory PATCH — keep that sequencing (action first, PATCH second,
   never reversed) when you wire in the real calls.

## Design tokens

All tokens live at the top of `src/index.css` as CSS custom properties
(`--ink`, `--paper`, `--risk`, `--ack`, `--resolved`, `--brand`, etc.) —
change them there once to re-theme the whole app.
