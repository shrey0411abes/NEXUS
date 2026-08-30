import React, { useState, useEffect } from 'react';
import { CrossDomainRiskCorrelation, PrioritizedRiskAction } from '../types';
import { fetchCrossDomainRisks, fetchRiskPriorities } from '../services/api';

interface CrossDomainRiskPanelProps {
  businessId: number | null;
  days?: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'var(--status-error)',
  HIGH: 'var(--status-pending)',
  MEDIUM: 'var(--accent-cyan)',
  LOW: 'var(--text-secondary)',
  HEALTHY: 'var(--status-success)',
};

export const CrossDomainRiskPanel: React.FC<CrossDomainRiskPanelProps> = ({
  businessId,
  days = 30,
}) => {
  const [priorities, setPriorities] = useState<PrioritizedRiskAction[]>([]);
  const [correlations, setCorrelations] = useState<CrossDomainRiskCorrelation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [prioritiesRes, correlationsRes] = await Promise.all([
          fetchRiskPriorities(businessId!, days),
          fetchCrossDomainRisks(businessId!, days),
        ]);
        if (isMounted) {
          setPriorities(prioritiesRes);
          setCorrelations(correlationsRes);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error fetching cross-domain risks';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [businessId, days]);

  if (!businessId) {
    return null;
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Priority Command Center */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>Operational Risk Prioritization Queue</span>
              {priorities.length > 0 && (
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
                  {priorities.length} Active Risks
                </span>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              <strong>What requires attention now, and why?</strong> Deterministic multi-domain risk ranking grounded in SQLite source of truth.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
            Phase 3B Deterministic Engine
          </span>
        </div>

        {loading && (
          <p style={{ color: 'var(--accent-cyan)', textAlign: 'center', padding: '1.5rem' }}>
            Evaluating cross-domain risk collisions and priority ranking...
          </p>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>
              ⚠ {error}
            </p>
          </div>
        )}

        {!loading && priorities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--status-success)', fontSize: '1.1rem', fontWeight: 600 }}>
              ✓ All Operational Domains Operating Within Normal Parameters
            </span>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              No critical inventory deficits or unmitigated demand collisions detected for this business.
            </p>
          </div>
        )}

        {/* Priority Action Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {priorities.map((item) => (
            <div
              key={item.priority_rank}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${
                  item.severity === 'CRITICAL'
                    ? 'rgba(239, 68, 68, 0.45)'
                    : item.severity === 'HIGH'
                    ? 'rgba(245, 158, 11, 0.45)'
                    : 'var(--border-color)'
                }`,
                borderRadius: '8px',
                padding: '1.25rem',
                position: 'relative',
              }}
            >
              {/* Header: Rank + Title + Severity + Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      background: item.severity === 'CRITICAL' ? 'var(--status-error)' : item.severity === 'HIGH' ? 'var(--status-pending)' : 'var(--accent-cyan)',
                      color: '#0d1117',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                    }}
                  >
                    RANK #{item.priority_rank}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {item.product_name || 'Business Scope'}
                    </h3>
                    {item.sku && (
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        SKU: {item.sku}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {item.affected_domains.map((dom) => (
                    <span
                      key={dom}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '0.15rem 0.4rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {dom}
                    </span>
                  ))}
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: SEVERITY_COLORS[item.severity],
                      border: `1px solid ${SEVERITY_COLORS[item.severity]}`,
                      borderRadius: '4px',
                      padding: '0.15rem 0.5rem',
                    }}
                  >
                    {item.severity}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--accent-cyan)',
                      background: 'rgba(100, 220, 255, 0.08)',
                      borderRadius: '4px',
                      padding: '0.15rem 0.5rem',
                    }}
                  >
                    Score: {item.priority_score.toFixed(1)}/100
                  </span>
                </div>
              </div>

              {/* Impact summary */}
              <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                <strong>Impact:</strong> {item.impact_summary}
              </p>

              {/* Recommended Action */}
              <div
                style={{
                  background: 'rgba(100, 220, 255, 0.04)',
                  borderLeft: '3px solid var(--accent-cyan)',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '0 6px 6px 0',
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  DIRECT ACTION:
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginLeft: '0.5rem' }}>
                  {item.recommended_action}
                </span>
              </div>

              {/* Verified Supporting Facts */}
              {item.supporting_facts.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
                    VERIFIED SOURCE FACTS (SQLITE)
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                    {item.supporting_facts.map((fact, fIdx) => (
                      <li key={fIdx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Domain Multi-Signal Correlation Matrix (Phase 3A) */}
      {correlations.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Cross-Domain Risk Correlations</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Multi-domain signal collisions (Inventory × Demand Momentum × Revenue)
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
              Phase 3A Matrix
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Product</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Correlation Type</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Domains</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Deterministic Finding</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Severity</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((c) => (
                  <tr key={c.correlation_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                      {c.product_name}
                      {c.sku && <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.sku}</span>}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {c.correlation_type}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {c.affected_domains.map((d) => (
                          <span
                            key={d}
                            style={{
                              fontSize: '0.65rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '3px',
                              padding: '0.1rem 0.35rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '380px' }}>
                      {c.deterministic_reason}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: SEVERITY_COLORS[c.severity],
                          border: `1px solid ${SEVERITY_COLORS[c.severity]}`,
                          borderRadius: '4px',
                          padding: '0.15rem 0.45rem',
                        }}
                      >
                        {c.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
