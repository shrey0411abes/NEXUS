export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

export type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';

// ─── Authentication Types ────────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface User {
  id: number;
  business_id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
  business_name: string;
}

export interface AuthMeResponse {
  user: User;
  business_id: number;
  business_name: string;
  business_industry: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  business_name: string;
  business_industry: string;
  email: string;
  password: string;
}

export type AuthState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; businessName: string; businessIndustry: string; token: string }
  | { status: 'error'; message: string };

export interface Business {
  id: number;
  name: string;
  industry: string;
  created_at: string;
}

// ─── Product & Inventory Types (M5-S1) ───────────────────────────────────────

export interface InventorySummary {
  id: number;
  product_id: number;
  quantity: number;
  reorder_level: number;
  updated_at: string;
}

export interface InventoryUpdateRequest {
  quantity?: number;
  reorder_level?: number;
}

export interface InventoryItemDetail {
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  unit_price: number;
  quantity: number;
  reorder_level: number;
  days_of_inventory: number | null;
  risk_level: string;
  updated_at: string;
}

export interface Product {
  id: number;
  business_id: number;
  name: string;
  category: string;
  sku: string;
  unit_price: number;
  created_at: string;
  inventory?: InventorySummary | null;
}

export interface ProductCreateRequest {
  name: string;
  category: string;
  sku: string;
  unit_price: number;
  business_id: number;
  initial_quantity?: number;
  reorder_level?: number;
}

export interface BusinessKPIs {
  business_id: number;
  observation_period_days: number;
  total_revenue: number;
  total_transactions: number;
  total_units_sold: number;
  average_transaction_value: number;
  active_products_count: number;
  low_stock_products_count: number;
  out_of_stock_products_count: number;
}

export interface StockRiskIndicator {
  product_id: number;
  product_name: string;
  sku: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  current_quantity: number;
  reorder_level: number;
  days_of_inventory: number | null;
  risk_reasons: string[];
}

export interface DemandTrend {
  product_id: number;
  product_name: string;
  sku: string;
  window_days: number;
  recent_avg_daily_sales: number;
  prior_avg_daily_sales: number;
  percentage_change: number | null;
  trend_direction: 'INCREASING' | 'STABLE' | 'DECREASING' | 'INSUFFICIENT_DATA';
}

export interface Recommendation {
  recommendation_type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  business_id: number;
  product_id?: number;
  product_name?: string;
  title: string;
  reason: string;
  supporting_metrics: Record<string, any>;
  action_summary: string;
}

export interface InvestigationRequest {
  business_id: number;
  question: string;
  days?: number;
}

export interface InvestigationResponse {
  question: string;
  answer: string;
  key_findings: string[];
  recommendations: string[];
  supporting_facts: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  limitations: string[];
}

// ─── Investigation History Types ────────────────────────────────────────────

export interface InvestigationAuditSummary {
  id: number;
  question: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  verification_status: string;
  provider: string;
  execution_duration_ms: number;
  created_at: string;
}

export interface InvestigationAuditDetail extends InvestigationAuditSummary {
  answer: string;
  context_snapshot: Record<string, unknown>;
}

export interface CrossDomainRiskCorrelation {
  correlation_id: string;
  business_id: number;
  product_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  correlation_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'HEALTHY';
  affected_domains: string[];
  supporting_metrics: Record<string, any>;
  supporting_facts: string[];
  deterministic_reason: string;
}

export interface PrioritizedRiskAction {
  priority_rank: number;
  priority_score: number;
  business_id: number;
  // ─── M5-S4 Persistence Fields ───────────────────────────────────
  risk_fingerprint: string;
  current_state: RiskState;
  last_actioned_at?: string | null;
  last_actioned_by?: number | null;
  last_action_note?: string | null;
  // ─── Existing Fields ─────────────────────────────────────────────
  product_id?: number | null;
  product_name?: string | null;
  sku?: string | null;
  risk_category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affected_domains: string[];
  supporting_facts: string[];
  impact_summary: string;
  recommended_action: string;
  source_status: string;
}

export interface CrossDomainAnalysisResult {
  business_id: number;
  observation_days: number;
  correlations_count: number;
  critical_risks_count: number;
  correlations: CrossDomainRiskCorrelation[];
  prioritized_queue: PrioritizedRiskAction[];
}

export interface SKUFinancialImpact {
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  unit_price: number;
  current_quantity: number;
  days_of_inventory: number | null;
  sales_velocity: number;
  risk_severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'HEALTHY';
  is_stockout_risk: boolean;
  is_stagnant: boolean;
  daily_revenue_exposure: number;
  projected_7d_revenue_exposure: number;
  projected_30d_revenue_exposure: number;
  retail_value_on_hand: number;
  trapped_retail_inventory_value: number;
  supporting_facts: string[];
  recommended_action: string;
  source_status: string;
}

export interface BusinessFinancialSummary {
  business_id: number;
  observation_days: number;
  total_daily_revenue_exposure: number;
  projected_7d_revenue_exposure: number;
  projected_30d_revenue_exposure: number;
  total_trapped_retail_inventory_value: number;
  total_retail_inventory_value_on_hand: number;
  financially_exposed_sku_count: number;
  stagnant_sku_count: number;
  total_active_sku_count: number;
  projection_disclaimer: string;
  cost_basis_disclaimer: string;
  impacted_skus: SKUFinancialImpact[];
}

// ─── Risk Action Types (M5-S4) ──────────────────────────────────────────────

export type RiskState = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

export interface RiskActionCreate {
  risk_fingerprint: string;
  product_id?: number | null;
  risk_category: string;
  state: RiskState;
  action_note?: string | null;
  metrics_snapshot?: Record<string, unknown>;
}

export interface RiskAction {
  id: number;
  business_id: number;
  user_id?: number | null;
  user_email?: string | null;
  product_id?: number | null;
  risk_fingerprint: string;
  risk_category: string;
  state: string;
  action_note?: string | null;
  metrics_snapshot: Record<string, unknown>;
  created_at: string;
}

// ─── Transaction Types (M5-S3) ──────────────────────────────────────────────

export type TransactionType = 'sale' | 'purchase' | 'refund' | 'adjustment';

export interface TransactionItemCreate {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface TransactionCreate {
  business_id: number;
  transaction_type: TransactionType;
  total_amount?: number | null;
  items: TransactionItemCreate[];
}

export interface TransactionItemResponse {
  id: number;
  transaction_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface TransactionResponse {
  id: number;
  business_id: number;
  transaction_type: string;
  total_amount: number;
  transaction_date: string;
  created_at: string;
  items: TransactionItemResponse[];
}
