import React, { useState, useEffect } from 'react';
import {
  Business,
  BusinessKPIs,
  StockRiskIndicator,
  DemandTrend,
  Recommendation
} from '../types';
import {
  fetchBusinesses,
  fetchBusinessKPIs,
  fetchInventoryRisks,
  fetchDemandTrends,
  fetchRecommendations
} from '../services/api';

interface AnalyticsDashboardProps {
  businessId?: number | null;
  onSelectBusiness?: (id: number) => void;
  days?: number;
  onSelectDays?: (days: number) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  businessId: propBusinessId,
  onSelectBusiness,
  days: propDays,
  onSelectDays,
}) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [internalBusinessId, setInternalBusinessId] = useState<number | null>(null);
  const [internalDays, setInternalDays] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<BusinessKPIs | null>(null);
  const [risks, setRisks] = useState<StockRiskIndicator[]>([]);
  const [trends, setTrends] = useState<DemandTrend[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const selectedBusinessId = propBusinessId !== undefined ? propBusinessId : internalBusinessId;
  const days = propDays !== undefined ? propDays : internalDays;

  const handleBusinessChange = (id: number) => {
    if (onSelectBusiness) onSelectBusiness(id);
    else setInternalBusinessId(id);
  };

  const handleDaysChange = (newDays: number) => {
    if (onSelectDays) onSelectDays(newDays);
    else setInternalDays(newDays);
  };

  // Load available businesses on mount
  useEffect(() => {
    async function loadBusinesses() {
      try {
        const list = await fetchBusinesses();
        setBusinesses(list);
        if (list.length > 0 && selectedBusinessId === null) {
          handleBusinessChange(list[0].id);
        }
      } catch (err: unknown) {
        console.error('Could not load businesses:', err);
      }
    }
    loadBusinesses();
  }, []);

  // Load analytics when selectedBusinessId or days change
  useEffect(() => {
    if (!selectedBusinessId) return;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const [kpiRes, riskRes, trendRes, recRes] = await Promise.all([
          fetchBusinessKPIs(selectedBusinessId!, days),
          fetchInventoryRisks(selectedBusinessId!, days),
          fetchDemandTrends(selectedBusinessId!, Math.max(7, Math.floor(days / 2))),
          fetchRecommendations(selectedBusinessId!, days)
        ]);
        setKpis(kpiRes);
        setRisks(riskRes);
        setTrends(trendRes);
        setRecommendations(recRes);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching analytics';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [selectedBusinessId, days]);

  if (businesses.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Deterministic Analytics Dashboard</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phase 1B Engine</span>
        </div>
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '1rem' }}>No business entities found in database.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Run <code>python scripts/seed_demo_data.py</code> or create a business via POST /api/v1/businesses to view calculated metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Controls Bar */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Business:</label>
          <select
            value={selectedBusinessId || ''}
            onChange={(e) => handleBusinessChange(Number(e.target.value))}
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.industry})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Observation Window:</label>
          <select
            value={days}
            onChange={(e) => handleDaysChange(Number(e.target.value))}
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.9rem'
            }}
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      {loading && (
        <p style={{ color: 'var(--accent-cyan)', textAlign: 'center', padding: '1.5rem' }}>
          Computing verified analytics from database...
        </p>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--status-error)' }}>
          <p style={{ color: 'var(--status-error)', fontSize: '0.9rem' }}>Analytics Error: {error}</p>
        </div>
      )}

      {/* 1. Core KPIs Grid */}
      {kpis && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Executive Key Performance Indicators (KPIs)</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{kpis.observation_period_days}-Day Window</span>
          </div>

          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-label">Total Sales Revenue</div>
              <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>
                ${kpis.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Completed Transactions</div>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                {kpis.total_transactions}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Total Units Sold</div>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                {kpis.total_units_sold}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Avg Transaction Value</div>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                ${kpis.average_transaction_value.toFixed(2)}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Catalog SKUs</div>
              <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                {kpis.active_products_count}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Low Stock Alerts</div>
              <div className="metric-value" style={{ color: kpis.low_stock_products_count > 0 ? 'var(--status-pending)' : 'var(--text-primary)', fontSize: '1.2rem' }}>
                {kpis.low_stock_products_count}
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-label">Out of Stock SKUs</div>
              <div className="metric-value" style={{ color: kpis.out_of_stock_products_count > 0 ? 'var(--status-error)' : 'var(--text-primary)', fontSize: '1.2rem' }}>
                {kpis.out_of_stock_products_count}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Prioritized Actionable Recommendations */}
      {recommendations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Deterministic Recommendations</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>Rule-Based Decision Logic</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${
                    rec.priority === 'CRITICAL'
                      ? 'rgba(239, 68, 68, 0.4)'
                      : rec.priority === 'HIGH'
                      ? 'rgba(245, 158, 11, 0.4)'
                      : 'var(--border-color)'
                  }`,
                  borderRadius: '8px',
                  padding: '1rem 1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {rec.title}
                  </span>
                  <span
                    className={`status-indicator status-${
                      rec.priority === 'CRITICAL' ? 'error' : rec.priority === 'HIGH' ? 'checking' : 'idle'
                    }`}
                    style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  {rec.reason}
                </p>
                <div style={{ fontSize: '0.825rem', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                  💡 Action: {rec.action_summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Inventory Stockout Risk Matrix */}
      {risks.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Stockout Risk & Coverage Matrix</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-Time Velocity Analysis</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Product</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>SKU</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Quantity</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Reorder Level</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Days Remaining</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {risks.map((item) => (
                  <tr key={item.product_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{item.product_name}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{item.sku}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{item.current_quantity}</td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{item.reorder_level}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {item.days_of_inventory !== null ? `${item.days_of_inventory} d` : 'No Sales Velocity'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        className={`status-indicator status-${
                          item.risk_level === 'CRITICAL'
                            ? 'error'
                            : item.risk_level === 'HIGH' || item.risk_level === 'MEDIUM'
                            ? 'checking'
                            : 'connected'
                        }`}
                        style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                      >
                        {item.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Demand Trend Momentum */}
      {trends.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Demand Trend Momentum</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparative Period Analysis</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {trends.map((t) => (
              <div key={t.product_id} className="metric-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.product_name}</span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color:
                        t.trend_direction === 'INCREASING'
                          ? 'var(--status-success)'
                          : t.trend_direction === 'DECREASING'
                          ? 'var(--status-error)'
                          : 'var(--text-secondary)'
                    }}
                  >
                    {t.trend_direction}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Recent: {t.recent_avg_daily_sales.toFixed(2)} /d vs Prior: {t.prior_avg_daily_sales.toFixed(2)} /d
                </div>
                {t.percentage_change !== null && (
                  <div style={{ fontSize: '0.8rem', color: t.percentage_change >= 0 ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {t.percentage_change >= 0 ? `+${(t.percentage_change * 100).toFixed(1)}%` : `${(t.percentage_change * 100).toFixed(1)}%`} Momentum
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
