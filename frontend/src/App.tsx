import React, { useState, useEffect } from 'react';
import { HealthCheck } from './components/HealthCheck';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CrossDomainRiskPanel } from './components/CrossDomainRiskPanel';
import { FinancialImpactPanel } from './components/FinancialImpactPanel';
import { BusinessInvestigation } from './components/BusinessInvestigation';
import { fetchBusinesses } from './services/api';

export const App: React.FC = () => {
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    fetchBusinesses()
      .then((list) => {
        if (list.length > 0 && selectedBusinessId === null) setSelectedBusinessId(list[0].id);
      })
      .catch(() => {/* backend may not be running yet */});
  }, []);

  return (
    <>
      <main className="app-container">
        <header className="app-header">
          <div className="brand-badge">BuildSprint 2026 • Phase 4A Active</div>
          <h1 className="app-title">NEXUS</h1>
          <p className="app-subtitle">
            AI Business Operating System — Deterministic Analytics, Revenue Exposure &amp; Natural-Language Investigation
          </p>
        </header>

        {/* Backend Connectivity Status */}
        <HealthCheck />

        {/* Phase 1B: Deterministic Analytics Dashboard */}
        <AnalyticsDashboard
          businessId={selectedBusinessId}
          onSelectBusiness={setSelectedBusinessId}
          days={days}
          onSelectDays={setDays}
        />

        {/* Phase 3A & 3B: Cross-Domain Intelligence & Operational Risk Prioritization */}
        <CrossDomainRiskPanel
          businessId={selectedBusinessId}
          days={days}
        />

        {/* Phase 4A: Financial Impact & Revenue Exposure */}
        <FinancialImpactPanel
          businessId={selectedBusinessId}
          days={days}
        />

        {/* Phase 2: AI Natural-Language Business Investigation */}
        <BusinessInvestigation businessId={selectedBusinessId} />

        {/* Architecture Notice */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h2 className="card-title">Engineering Architecture</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Modular Monolith — Phase 3B Active</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            NEXUS enforces strict <strong>deterministic-first</strong> architecture:
            <br />
            <code>SQLITE SOURCE OF TRUTH → DETERMINISTIC ANALYTICS → VERIFIED BUSINESS FACTS → CROSS-DOMAIN CORRELATIONS → OPERATIONAL RISK PRIORITIZATION → AI/LLM INTERPRETATION</code>
            <br /><br />
            All numerical metrics and priority ranks are calculated deterministically. The AI layer receives only <strong>verified facts</strong> and is constrained to explain — never fabricate — business realities.
          </p>
        </div>
      </main>

      <footer className="footer">
        NEXUS &copy; 2026 • Built for 48-Hour BuildSprint • Phase 3B: Operational Risk Prioritization Active
      </footer>
    </>
  );
};

export default App;
