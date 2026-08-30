import React, { useState, useEffect } from 'react';
import { BusinessFinancialSummary, SKUFinancialImpact } from '../types';
import { fetchBusinessFinancialSummary } from '../services/api';

interface FinancialImpactPanelProps {
  businessId: number | null;
  days?: number;
}

export const FinancialImpactPanel: React.FC<FinancialImpactPanelProps> = ({
  businessId,
  days = 30,
}) => {
  const [summary, setSummary] = useState<BusinessFinancialSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    let isMounted = true;
    async function loadFinancialData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchBusinessFinancialSummary(businessId!, days);
        if (isMounted) setSummary(res);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch financial intelligence';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFinancialData();
    return () => {
      isMounted = false;
    };
  }, [businessId, days]);

  if (!businessId) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>Financial Impact &amp; Revenue Exposure</span>
              {summary && summary.financially_exposed_sku_count > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--status-error)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  ${summary.total_daily_revenue_exposure.toFixed(2)}/day at Risk
                </span>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              <strong>What is the financial consequence of the operational risk?</strong> Deterministic revenue exposure and retail asset valuation.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
            Phase 4A Financial Engine
          </span>
        </div>

        {loading && (
          <p style={{ color: 'var(--accent-cyan)', textAlign: 'center', padding: '1.5rem' }}>
            Computing verified revenue exposures and retail asset valuations...
          </p>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>
              ⚠ {error}
            </p>
          </div>
        )}

        {summary && !loading && (
          <>
            {/* Top Financial Metrics Grid */}
            <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="metric-item">
                <div className="metric-label">Daily Revenue Exposure</div>
                <div
                  className="metric-value"
                  style={{
                    color: summary.total_daily_revenue_exposure > 0 ? 'var(--status-error)' : 'var(--text-primary)',
                    fontSize: '1.25rem',
                  }}
                >
                  ${summary.total_daily_revenue_exposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                    per day (Stockout run-rate)
                  </span>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-label">7-Day Projected Exposure</div>
                <div
                  className="metric-value"
                  style={{
                    color: summary.projected_7d_revenue_exposure > 0 ? 'var(--status-pending)' : 'var(--text-primary)',
                    fontSize: '1.25rem',
                  }}
                >
                  ${summary.projected_7d_revenue_exposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                    Unrealized sales risk
                  </span>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-label">30-Day Projected Exposure</div>
                <div
                  className="metric-value"
                  style={{
                    color: summary.projected_30d_revenue_exposure > 0 ? 'var(--status-pending)' : 'var(--text-primary)',
                    fontSize: '1.25rem',
                  }}
                >
                  ${summary.projected_30d_revenue_exposure.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                    Monthly cumulative
                  </span>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-label">Trapped Retail Inventory</div>
                <div
                  className="metric-value"
                  style={{
                    color: summary.total_trapped_retail_inventory_value > 0 ? 'var(--accent-purple)' : 'var(--text-primary)',
                    fontSize: '1.25rem',
                  }}
                >
                  ${summary.total_trapped_retail_inventory_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                    Stagnant retail asset value
                  </span>
                </div>
              </div>

              <div className="metric-item">
                <div className="metric-label">Retail Value on Hand</div>
                <div className="metric-value" style={{ color: 'var(--accent-cyan)', fontSize: '1.25rem' }}>
                  ${summary.total_retail_inventory_value_on_hand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', fontWeight: 400 }}>
                    Total catalog valuation
                  </span>
                </div>
              </div>
            </div>

            {/* Disclaimers & Data Boundary Notices */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: '2px solid var(--accent-cyan)' }}>
                ℹ <strong>Projection Note:</strong> {summary.projection_disclaimer}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: '2px solid var(--text-muted)' }}>
                🔒 <strong>Data Boundary:</strong> {summary.cost_basis_disclaimer}
              </div>
            </div>

            {/* Impacted SKUs Table */}
            {summary.impacted_skus.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                  FINANCIALLY EXPOSED &amp; STAGNANT SKUS
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Product / SKU</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Unit Price</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Stock / Coverage</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Velocity</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Daily Exposure</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>7-Day Projected</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Trapped Value</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.impacted_skus.map((sku: SKUFinancialImpact) => (
                      <tr key={sku.product_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                          {sku.product_name}
                          <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {sku.sku}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>
                          ${sku.unit_price.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ color: sku.current_quantity === 0 ? 'var(--status-error)' : 'var(--text-primary)', fontWeight: 600 }}>
                            {sku.current_quantity} units
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {sku.days_of_inventory !== null ? `${sku.days_of_inventory} d` : 'No Velocity'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>
                          {sku.sales_velocity.toFixed(2)} /d
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: sku.daily_revenue_exposure > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
                          {sku.daily_revenue_exposure > 0 ? `$${sku.daily_revenue_exposure.toFixed(2)}/d` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: sku.projected_7d_revenue_exposure > 0 ? 'var(--status-pending)' : 'var(--text-muted)' }}>
                          {sku.projected_7d_revenue_exposure > 0 ? `$${sku.projected_7d_revenue_exposure.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: sku.trapped_retail_inventory_value > 0 ? 'var(--accent-purple)' : 'var(--text-muted)', fontWeight: sku.trapped_retail_inventory_value > 0 ? 600 : 400 }}>
                          {sku.trapped_retail_inventory_value > 0 ? `$${sku.trapped_retail_inventory_value.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '280px' }}>
                          {sku.recommended_action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active SKUs have revenue exposure or trapped retail inventory for the selected observation window.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
