// Mock data shaped to match the real NEXUS backend schemas.
// Swap the exported arrays/functions here for real fetch() calls against
// /api/v1/cross-domain/*, /api/v1/inventory, /api/v1/transactions, etc.
// when wiring this UI to the live backend.

export const KPIS = [
  { label: 'Open risks', value: '7', tone: 'risk' },
  { label: 'Avg. time to acknowledge', value: '41m', tone: null },
  { label: 'Resolved this week', value: '23', tone: 'resolved' },
  { label: 'Total inventory value', value: '$1.25M', tone: null },
]

export const RISK_QUEUE = [
  {
    id: 1,
    priority_rank: 1,
    priority_score: 92.4,
    risk_fingerprint: 'a13f...9e02',
    risk_category: 'SURGE_STOCKOUT_SQUEEZE',
    product_name: '4x Concentrated Laundry Detergent',
    sku: 'SKU003938',
    severity: 'CRITICAL',
    current_state: 'OPEN',
    impact_summary: 'Sales velocity is outpacing remaining stock by 3.2x this week.',
    recommended_action: 'Expedite purchase order; consider temporary reorder threshold increase.',
    last_actioned_at: null,
    last_actioned_by: null,
    last_action_note: null,
  },
  {
    id: 2,
    priority_rank: 2,
    priority_score: 84.1,
    risk_fingerprint: 'c7b2...41aa',
    risk_category: 'DEAD_STOCK_CAPITAL_TRAP',
    product_name: 'Scented Soy Candle',
    sku: 'SKU002210',
    severity: 'HIGH',
    current_state: 'ACKNOWLEDGED',
    impact_summary: '$46,055.80 in inventory value with zero turnover in 60 days.',
    recommended_action: 'Consider markdown or bundle promotion to release working capital.',
    last_actioned_at: '2026-09-20T08:22:00Z',
    last_actioned_by: 'O. Singh',
    last_action_note: 'Flagged for next promo cycle review.',
  },
  {
    id: 3,
    priority_rank: 3,
    priority_score: 77.8,
    risk_fingerprint: '9d41...0bf3',
    risk_category: 'ACCELERATING_DEPLETION',
    product_name: 'Dryer-Activated Fabric Sheets',
    sku: 'SKU003366',
    severity: 'HIGH',
    current_state: 'OPEN',
    impact_summary: 'Depletion rate accelerated 2.1x over the last 14 days.',
    recommended_action: 'Review reorder point; verify supplier lead time.',
    last_actioned_at: null,
    last_actioned_by: null,
    last_action_note: null,
  },
  {
    id: 4,
    priority_rank: 4,
    priority_score: 61.0,
    risk_fingerprint: 'e08a...77c1',
    risk_category: 'UNPROTECTED_DEMAND_SPIKE',
    product_name: 'Gel Body Wash Refill',
    sku: 'SKU001204',
    severity: 'MEDIUM',
    current_state: 'RESOLVED',
    impact_summary: 'Demand spike 40% above forecast with no safety stock buffer.',
    recommended_action: 'Increase safety stock buffer ahead of next seasonal spike.',
    last_actioned_at: '2026-09-19T14:03:00Z',
    last_actioned_by: 'O. Singh',
    last_action_note: 'Stock replenished via PO #982.',
  },
]

export const RISK_HISTORY = [
  {
    id: 101,
    created_at: '2026-09-19T14:03:00Z',
    risk_category: 'UNPROTECTED_DEMAND_SPIKE',
    sku: 'SKU001204',
    state: 'RESOLVED',
    actor: 'O. Singh',
    action_note: 'Stock replenished via PO #982.',
  },
  {
    id: 100,
    created_at: '2026-09-19T09:11:00Z',
    risk_category: 'UNPROTECTED_DEMAND_SPIKE',
    sku: 'SKU001204',
    state: 'ACKNOWLEDGED',
    actor: 'O. Singh',
    action_note: 'Expedited purchase order placed.',
  },
  {
    id: 99,
    created_at: '2026-09-18T17:40:00Z',
    risk_category: 'DEAD_STOCK_CAPITAL_TRAP',
    sku: 'SKU002210',
    state: 'ACKNOWLEDGED',
    actor: 'O. Singh',
    action_note: 'Flagged for next promo cycle review.',
  },
  {
    id: 98,
    created_at: '2026-09-15T06:02:00Z',
    risk_category: 'STOCKOUT_IMMINENT',
    sku: 'SKU003005',
    state: 'OPEN',
    actor: null,
    action_note: 'auto-reopened: cooldown expired',
  },
]

export const INVENTORY = [
  { product: '4x Concentrated Laundry Detergent', sku: 'SKU003938', category: 'Laundry', qty: 12, reorder_level: 40, risk: 'Critical' },
  { product: 'Foaming Hand Wash Refill', sku: 'SKU000228', category: 'Hand', qty: 88, reorder_level: 50, risk: 'Low Stock' },
  { product: 'Scented Soy Candle', sku: 'SKU002210', category: 'Home Cleaning', qty: 340, reorder_level: 30, risk: 'None' },
  { product: 'Dryer-Activated Fabric Sheets', sku: 'SKU003366', category: 'Laundry', qty: 21, reorder_level: 45, risk: 'Critical' },
  { product: 'Gel Body Wash Refill', sku: 'SKU001204', category: 'Body', qty: 76, reorder_level: 35, risk: 'None' },
  { product: 'Bathroom Cleaner', sku: 'SKU001678', category: 'Home Cleaning', qty: 54, reorder_level: 25, risk: 'None' },
]

export const TRANSACTIONS = [
  { id: 5231, type: 'sale', items: 3, total: 84.5, date: '2026-09-22T10:14:00Z' },
  { id: 5230, type: 'sale', items: 1, total: 12.99, date: '2026-09-22T09:52:00Z' },
  { id: 5229, type: 'purchase', items: 40, total: 612.0, date: '2026-09-22T08:30:00Z' },
  { id: 5228, type: 'refund', items: 1, total: -18.5, date: '2026-09-21T17:05:00Z' },
  { id: 5227, type: 'sale', items: 5, total: 143.2, date: '2026-09-21T15:41:00Z' },
]

export const INVENTORY_TREND = [
  { month: 'Apr', value: 2350000 },
  { month: 'May', value: 2410000 },
  { month: 'Jun', value: 2280000 },
  { month: 'Jul', value: 2390000 },
  { month: 'Aug', value: 2460000 },
  { month: 'Sep', value: 2312000 },
]

export const FINANCIAL = {
  totalInventoryValue: '$8.5M',
  atRiskInventory: '15%',
  stockoutRisk: '8.2%',
  supplierDelays: '12%',
  onTimeDelivery: '93%',
  riskAssessment: [
    { label: 'Low', pct: 55, tone: 'resolved' },
    { label: 'Moderate', pct: 30, tone: 'ack' },
    { label: 'High', pct: 15, tone: 'risk' },
  ],
}

export const ASSISTANT_MESSAGES = [
  { role: 'user', text: 'Which SKUs are trapping the most capital right now?' },
  {
    role: 'assistant',
    text: 'Three items are flagged dead-stock this week, totalling $46,055.80 in tied-up inventory value.',
    source: 'source: verified_fact · inventory table',
  },
  { role: 'user', text: 'Has anyone acted on the stockout squeeze on SKU003938?' },
  {
    role: 'assistant',
    text: "Not yet — it's been open 41 minutes, unacknowledged. Rank 1 in the current queue.",
  },
]
