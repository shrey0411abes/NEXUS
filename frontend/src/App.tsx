import React, { useState, useEffect } from 'react';
import { HealthCheck } from './components/HealthCheck';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CrossDomainRiskPanel } from './components/CrossDomainRiskPanel';
import { FinancialImpactPanel } from './components/FinancialImpactPanel';
import { BusinessInvestigation } from './components/BusinessInvestigation';
import { ProductCatalog } from './components/ProductCatalog';
import { InventoryManager } from './components/InventoryManager';
import { TransactionRecording } from './components/TransactionRecording';
import { AuthModal } from './components/AuthModal';

import { fetchCurrentUser, logoutUser, getAuthToken } from './services/api';
import { AuthState, TokenResponse } from './types';

export const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [days, setDays] = useState<number>(30);
  const [analyticsVersion, setAnalyticsVersion] = useState<number>(0);

  const handleInventoryUpdated = () => {
    setAnalyticsVersion((v) => v + 1);
  };

  // On mount, try to restore session from persisted token
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthState({ status: 'idle' });
      return;
    }
    // Validate stored token with /auth/me
    fetchCurrentUser()
      .then((me) => {
        setAuthState({
          status: 'authenticated',
          user: me.user,
          businessName: me.business_name,
          businessIndustry: me.business_industry,
          token,
        });
      })
      .catch(() => {
        // Token invalid or expired
        logoutUser();
        setAuthState({ status: 'idle' });
      });
  }, []);

  const handleAuthSuccess = (data: TokenResponse) => {
    setAuthState({
      status: 'authenticated',
      user: data.user,
      businessName: data.business_name,
      // fetchCurrentUser on next refresh will populate industry; use placeholder here
      businessIndustry: '',
      token: data.access_token,
    });
  };

  const handleLogout = () => {
    logoutUser();
    setAuthState({ status: 'idle' });
  };

  // Show auth modal when unauthenticated or idle
  const showAuthModal = authState.status === 'idle' || authState.status === 'error';

  return (
    <>
      {showAuthModal && <AuthModal onAuthSuccess={handleAuthSuccess} />}

      <main className="app-container">
        <header className="app-header">
          <div className="app-header-row">
            <div>
              <div className="brand-badge">NEXUS · Milestone 1 · Auth Active</div>
              <h1 className="app-title">NEXUS</h1>
              <p className="app-subtitle">
                AI Business Operating System — Deterministic Analytics, Revenue Exposure &amp; Natural-Language Investigation
              </p>
            </div>

            {/* User bar shown when authenticated */}
            {authState.status === 'authenticated' && (
              <div className="user-bar" style={{ marginTop: '0.5rem' }}>
                <span className="user-bar-business">{authState.businessName}</span>
                <span className="user-bar-role">{authState.user.role}</span>
                <span className="user-bar-email">{authState.user.email}</span>
                <button
                  id="logout-btn"
                  className="user-bar-logout"
                  onClick={handleLogout}
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            )}

            {authState.status === 'loading' && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
                Restoring session…
              </div>
            )}
          </div>
        </header>

        {/* Only render protected panels when authenticated */}
        {authState.status === 'authenticated' && (
          <>
            {/* Backend Connectivity Status */}
            <HealthCheck />

            {/* M5-S1: Product Catalog & SKU Registry */}
            <ProductCatalog
              key={`catalog-${analyticsVersion}`}
              businessId={authState.user.business_id}
              userRole={authState.user.role}
            />

            {/* M5-S2: Inventory Control & Stock Level Adjustments */}
            <InventoryManager
              key={`inventory-${analyticsVersion}`}
              businessId={authState.user.business_id}
              userRole={authState.user.role}
              days={days}
              onInventoryUpdated={handleInventoryUpdated}
            />

            {/* M5-S3: Point of Sale & Transaction Recording */}
            <TransactionRecording
              businessId={authState.user.business_id}
              userRole={authState.user.role}
              onTransactionComplete={handleInventoryUpdated}
            />

            {/* Phase 1B: Deterministic Analytics Dashboard */}
            <AnalyticsDashboard
              key={`analytics-${days}-${analyticsVersion}`}
              days={days}
              onSelectDays={setDays}
            />

            {/* Phase 3A & 3B: Cross-Domain Intelligence & Operational Risk Prioritization */}
            <CrossDomainRiskPanel
              key={`cross-domain-${days}-${analyticsVersion}`}
              days={days}
              userRole={authState.user.role}
              onInventoryUpdated={handleInventoryUpdated}
            />

            {/* Phase 4A: Financial Impact & Revenue Exposure */}
            <FinancialImpactPanel
              key={`financial-${days}-${analyticsVersion}`}
              days={days}
            />

            {/* Phase 2: AI Natural-Language Business Investigation */}
            <BusinessInvestigation businessId={authState.user.business_id} />

            {/* Architecture Notice */}
            <div className="card" style={{ marginTop: '2rem' }}>
              <div className="card-header">
                <h2 className="card-title">Engineering Architecture</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Milestone 1: Auth Active</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                NEXUS enforces strict <strong>deterministic-first</strong> architecture with <strong>JWT multi-tenant isolation</strong>:
                <br />
                <code>JWT → DB User → Tenant Business → Deterministic Analytics → Verified Business Facts → Cross-Domain Correlations → AI/LLM Interpretation</code>
                <br /><br />
                All numerical metrics are calculated deterministically. The AI layer receives only <strong>verified facts</strong> from the authenticated tenant and is constrained to explain — never fabricate — business realities.
              </p>
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        NEXUS &copy; 2026 • Milestone 1: JWT Auth, RBAC &amp; Multi-Tenant Isolation Active
      </footer>
    </>
  );
};

export default App;
