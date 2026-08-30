import {
  HealthResponse,
  Business,
  BusinessKPIs,
  StockRiskIndicator,
  DemandTrend,
  Recommendation,
  InvestigationRequest,
  InvestigationResponse,
  CrossDomainRiskCorrelation,
  PrioritizedRiskAction,
  CrossDomainAnalysisResult,
  SKUFinancialImpact,
  BusinessFinancialSummary,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchBusinesses(): Promise<Business[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/businesses`);
  if (!response.ok) {
    throw new Error(`Failed to fetch businesses: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchBusinessKPIs(businessId: number, days: number = 30): Promise<BusinessKPIs> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics/kpis?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch KPIs: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchInventoryRisks(businessId: number, days: number = 30): Promise<StockRiskIndicator[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics/inventory-risk?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch inventory risks: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchDemandTrends(businessId: number, days: number = 14): Promise<DemandTrend[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analytics/trends?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch demand trends: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRecommendations(businessId: number, days: number = 30): Promise<Recommendation[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/recommendations?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch recommendations: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchCrossDomainRisks(businessId: number, days: number = 30): Promise<CrossDomainRiskCorrelation[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/cross-domain/risks?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cross-domain risks: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRiskPriorities(businessId: number, days: number = 30): Promise<PrioritizedRiskAction[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/cross-domain/priorities?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch risk priorities: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchCrossDomainSummary(businessId: number, days: number = 30): Promise<CrossDomainAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/cross-domain/summary?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cross-domain summary: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSKUFinancialImpacts(businessId: number, days: number = 30): Promise<SKUFinancialImpact[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/financial/impact?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch SKU financial impacts: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchBusinessFinancialSummary(businessId: number, days: number = 30): Promise<BusinessFinancialSummary> {
  const response = await fetch(`${API_BASE_URL}/api/v1/financial/summary?business_id=${businessId}&days=${days}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch business financial summary: ${response.statusText}`);
  }
  return response.json();
}

export async function investigateBusiness(request: InvestigationRequest): Promise<InvestigationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investigations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Investigation failed: ${response.status}`);
  }
  return response.json();
}

