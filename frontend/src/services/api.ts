import {
  HealthResponse,
  BusinessKPIs,
  StockRiskIndicator,
  DemandTrend,
  Recommendation,
  InvestigationRequest,
  InvestigationResponse,
  InvestigationAuditSummary,
  InvestigationAuditDetail,
  CrossDomainRiskCorrelation,
  PrioritizedRiskAction,
  CrossDomainAnalysisResult,
  SKUFinancialImpact,
  BusinessFinancialSummary,
  TokenResponse,
  LoginRequest,
  RegisterRequest,
  AuthMeResponse,
  Product,
  ProductCreateRequest,
  InventorySummary,
  InventoryUpdateRequest,
  TransactionCreate,
  TransactionResponse,
  RiskActionCreate,
  RiskAction,
} from '../types';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Auth Token Storage ───────────────────────────────────────────────────────

const TOKEN_KEY = 'nexus_access_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Centralized Fetch with Auto-Auth ────────────────────────────────────────

/**
 * Authenticated fetch wrapper. Automatically attaches the Bearer token if available.
 * Throws ApiError with status code on non-OK responses.
 */
async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) { /* non-JSON error body */ }
    throw new ApiError(response.status, detail);
  }
  return response;
}

// ─── Auth Functions ───────────────────────────────────────────────────────────

export async function loginUser(request: LoginRequest): Promise<TokenResponse> {
  const response = await expectOk(await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
  const data: TokenResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

export async function registerUser(request: RegisterRequest): Promise<TokenResponse> {
  const response = await expectOk(await apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
  const data: TokenResponse = await response.json();
  setAuthToken(data.access_token);
  return data;
}

export async function fetchCurrentUser(): Promise<AuthMeResponse> {
  const response = await expectOk(await apiFetch('/api/v1/auth/me'));
  return response.json();
}

export function logoutUser(): void {
  clearAuthToken();
}

// ─── Public Endpoints ─────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new ApiError(response.status, `Health check failed with status: ${response.status}`);
  }
  return response.json();
}

// ─── Protected Business Endpoints ─────────────────────────────────────────────

export async function fetchBusinessKPIs(days: number = 30): Promise<BusinessKPIs> {
  const response = await expectOk(await apiFetch(`/api/v1/analytics/kpis?days=${days}`));
  return response.json();
}

export async function fetchInventoryRisks(days: number = 30): Promise<StockRiskIndicator[]> {
  const response = await expectOk(await apiFetch(`/api/v1/analytics/inventory-risk?days=${days}`));
  return response.json();
}

export async function fetchDemandTrends(days: number = 14): Promise<DemandTrend[]> {
  const response = await expectOk(await apiFetch(`/api/v1/analytics/trends?days=${days}`));
  return response.json();
}

export async function fetchRecommendations(days: number = 30): Promise<Recommendation[]> {
  const response = await expectOk(await apiFetch(`/api/v1/recommendations?days=${days}`));
  return response.json();
}

export async function fetchCrossDomainRisks(days: number = 30): Promise<CrossDomainRiskCorrelation[]> {
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/risks?days=${days}`));
  return response.json();
}

export async function fetchRiskPriorities(
  days: number = 30,
  includeResolved: boolean = false,
): Promise<PrioritizedRiskAction[]> {
  const params = new URLSearchParams({ days: String(days), include_resolved: String(includeResolved) });
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/priorities?${params}`));
  return response.json();
}

export async function fetchCrossDomainSummary(days: number = 30): Promise<CrossDomainAnalysisResult> {
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/summary?days=${days}`));
  return response.json();
}

export async function fetchSKUFinancialImpacts(days: number = 30): Promise<SKUFinancialImpact[]> {
  const response = await expectOk(await apiFetch(`/api/v1/financial/impact?days=${days}`));
  return response.json();
}

export async function fetchBusinessFinancialSummary(days: number = 30): Promise<BusinessFinancialSummary> {
  const response = await expectOk(await apiFetch(`/api/v1/financial/summary?days=${days}`));
  return response.json();
}

// ─── Risk Action Endpoints (M5-S4) ──────────────────────────────────────────────

export async function recordRiskAction(action: RiskActionCreate): Promise<RiskAction> {
  const response = await expectOk(
    await apiFetch('/api/v1/cross-domain/actions', {
      method: 'POST',
      body: JSON.stringify(action),
    }),
  );
  return response.json();
}

export async function fetchRiskActions(
  opts: { state?: string; product_id?: number; limit?: number; offset?: number } = {},
): Promise<RiskAction[]> {
  const params = new URLSearchParams();
  if (opts.state) params.set('state', opts.state);
  if (opts.product_id != null) params.set('product_id', String(opts.product_id));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params}` : '';
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/actions${qs}`));
  return response.json();
}

export async function investigateBusiness(request: InvestigationRequest): Promise<InvestigationResponse> {
  const response = await expectOk(await apiFetch('/api/v1/investigations', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
  return response.json();
}

export async function fetchInvestigationHistory(
  limit: number = 50,
  offset: number = 0,
): Promise<InvestigationAuditSummary[]> {
  const response = await expectOk(
    await apiFetch(`/api/v1/investigations?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

export async function fetchInvestigationDetail(id: number): Promise<InvestigationAuditDetail> {
  const response = await expectOk(await apiFetch(`/api/v1/investigations/${id}`));
  return response.json();
}

// ─── Product Catalog Endpoints (M5-S1) ───────────────────────────────────────

export async function fetchProducts(
  limit: number = 100,
  offset: number = 0,
): Promise<Product[]> {
  const response = await expectOk(
    await apiFetch(`/api/v1/products?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

export async function createProduct(
  product: ProductCreateRequest,
): Promise<Product> {
  const response = await expectOk(
    await apiFetch('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),
  );
  return response.json();
}

// ─── Inventory Management Endpoints (M5-S2) ──────────────────────────────────

export async function fetchInventory(
  limit: number = 100,
  offset: number = 0,
): Promise<InventorySummary[]> {
  const response = await expectOk(
    await apiFetch(`/api/v1/inventory?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

export async function fetchInventoryForProduct(
  productId: number,
): Promise<InventorySummary> {
  const response = await expectOk(
    await apiFetch(`/api/v1/inventory/${productId}`),
  );
  return response.json();
}

export async function updateInventory(
  productId: number,
  update: InventoryUpdateRequest,
): Promise<InventorySummary> {
  const response = await expectOk(
    await apiFetch(`/api/v1/inventory/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),
  );
  return response.json();
}

// ─── Transaction Endpoints (M5-S3) ────────────────────────────────────────

export async function createTransaction(
  transaction: TransactionCreate,
): Promise<TransactionResponse> {
  const response = await expectOk(
    await apiFetch('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    }),
  );
  return response.json();
}

export async function fetchTransactions(
  limit: number = 100,
  offset: number = 0,
): Promise<TransactionResponse[]> {
  const response = await expectOk(
    await apiFetch(`/api/v1/transactions?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}
