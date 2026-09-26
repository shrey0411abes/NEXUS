// ─── Base URL ─────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Auth Token Storage ───────────────────────────────────────────────────────

const TOKEN_KEY = 'nexus_access_token';

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Centralized Fetch with Auto-Auth ────────────────────────────────────────

/**
 * Authenticated fetch wrapper. Automatically attaches the Bearer token if available.
 * Throws ApiError with status code on non-OK responses.
 */
async function apiFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function expectOk(response) {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch (_) { /* non-JSON error body */ }

    if (response.status === 401) {
      clearAuthToken();
      cachedUserContext = null;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nexus-auth-state-changed'));
      }
    }

    throw new ApiError(response.status, detail);
  }
  return response;
}

// ─── Auth Functions ───────────────────────────────────────────────────────────

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export async function loginUser(request) {
  const response = await expectOk(await apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
  const data = await response.json();
  setAuthToken(data.access_token);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus-auth-state-changed'));
  }
  return data;
}

export async function registerUser(request) {
  const response = await expectOk(await apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(request),
  }));
  const data = await response.json();
  setAuthToken(data.access_token);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus-auth-state-changed'));
  }
  return data;
}

let cachedUserContext = null;
let currentUserPromise = null;

export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) {
    cachedUserContext = null;
    throw new ApiError(401, 'No authentication token available');
  }

  if (currentUserPromise) {
    return currentUserPromise;
  }

  currentUserPromise = (async () => {
    try {
      const response = await expectOk(await apiFetch('/api/v1/auth/me'));
      const data = await response.json();
      cachedUserContext = data;
      return data;
    } finally {
      currentUserPromise = null;
    }
  })();

  return currentUserPromise;
}

export function getCachedUserContext() {
  return cachedUserContext;
}

export function logoutUser() {
  cachedUserContext = null;
  clearAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus-auth-state-changed'));
  }
}

// ─── Analytics / Dashboard ───────────────────────────────────────────────────

export async function fetchBusinessKPIs(days = 30) {
  const response = await expectOk(await apiFetch(`/api/v1/analytics/kpis?days=${days}`));
  return response.json();
}

export async function fetchBusinessTrends(days = 14) {
  const response = await expectOk(await apiFetch(`/api/v1/analytics/trends?days=${days}`));
  return response.json();
}

export async function fetchRecommendations(days = 30) {
  const response = await expectOk(await apiFetch(`/api/v1/recommendations?days=${days}`));
  return response.json();
}

// ─── Cross-Domain Risk / Priority Queue ──────────────────────────────────────

export async function fetchCrossDomainRisks(days = 30) {
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/risks?days=${days}`));
  return response.json();
}

export async function fetchRiskPriorities(days = 30, includeResolved = false) {
  const params = new URLSearchParams({ days: String(days), include_resolved: String(includeResolved) });
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/priorities?${params}`));
  return response.json();
}

export async function recordRiskAction(action) {
  // action: { risk_fingerprint, product_id, risk_category, state, action_note }
  const response = await expectOk(
    await apiFetch('/api/v1/cross-domain/actions', {
      method: 'POST',
      body: JSON.stringify(action),
    }),
  );
  return response.json();
}

export async function fetchRiskActions(opts = {}) {
  const params = new URLSearchParams();
  if (opts.state) params.set('state', opts.state);
  if (opts.product_id != null) params.set('product_id', String(opts.product_id));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params}` : '';
  const response = await expectOk(await apiFetch(`/api/v1/cross-domain/actions${qs}`));
  return response.json();
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(opts = {}) {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.offset != null) params.set('offset', String(opts.offset));
  if (opts.include_archived != null) params.set('include_archived', String(opts.include_archived));
  const qs = params.toString() ? `?${params}` : '';
  const response = await expectOk(await apiFetch(`/api/v1/products${qs}`));
  return response.json();
}

export async function createProduct(product) {
  const response = await expectOk(
    await apiFetch('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),
  );
  return response.json();
}

export async function updateProduct(productId, update) {
  const response = await expectOk(
    await apiFetch(`/api/v1/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),
  );
  return response.json();
}

export async function archiveProduct(productId) {
  const response = await expectOk(
    await apiFetch(`/api/v1/products/${productId}/archive`, {
      method: 'POST',
    }),
  );
  return response.json();
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export async function fetchInventory(limit = 100, offset = 0) {
  const response = await expectOk(
    await apiFetch(`/api/v1/inventory?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

export async function updateInventory(productId, update) {
  // IMPORTANT: Always call recordRiskAction first, then this function — never reversed.
  const response = await expectOk(
    await apiFetch(`/api/v1/inventory/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    }),
  );
  return response.json();
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function fetchTransactions(limit = 100, offset = 0) {
  const response = await expectOk(
    await apiFetch(`/api/v1/transactions?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

export async function createTransaction(transaction) {
  const response = await expectOk(
    await apiFetch('/api/v1/transactions', {
      method: 'POST',
      body: JSON.stringify(transaction),
    }),
  );
  return response.json();
}


// ─── Financial Impact ─────────────────────────────────────────────────────────

export async function fetchSKUFinancialImpacts(days = 30) {
  const response = await expectOk(await apiFetch(`/api/v1/financial/impact?days=${days}`));
  return response.json();
}

export async function fetchBusinessFinancialSummary(days = 30) {
  const response = await expectOk(await apiFetch(`/api/v1/financial/summary?days=${days}`));
  return response.json();
}

// ─── Investigations (AI Chat & History) ──────────────────────────────────────

export async function investigateBusiness(request) {
  // request: { question: string, days?: number, business_id?: number } or { query: string }
  const question = (request.question || request.query || '').trim();
  const days = request.days || 30;

  // Derive business_id from verified session context if not explicitly provided
  let businessId = request.business_id;
  if (businessId == null && cachedUserContext?.business_id) {
    businessId = cachedUserContext.business_id;
  }

  // Build payload strictly adhering to InvestigationRequest schema
  const payload = {
    question,
    days,
    ...(businessId != null ? { business_id: businessId } : {}),
  };

  const response = await expectOk(
    await apiFetch('/api/v1/investigations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  );
  return response.json();
}

export async function fetchInvestigationHistory(limit = 50, offset = 0) {
  const response = await expectOk(
    await apiFetch(`/api/v1/investigations?limit=${limit}&offset=${offset}`),
  );
  return response.json();
}

