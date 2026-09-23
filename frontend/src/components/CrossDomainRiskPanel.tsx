import React, { useState, useEffect, useCallback } from 'react';
import {
  CrossDomainRiskCorrelation,
  PrioritizedRiskAction,
  RiskAction,
  RiskActionCreate,
  RiskState,
  UserRole,
  InventoryUpdateRequest,
} from '../types';
import {
  fetchCrossDomainRisks,
  fetchRiskPriorities,
  fetchRiskActions,
  recordRiskAction,
  updateInventory,
  ApiError,
} from '../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

interface CrossDomainRiskPanelProps {
  days?: number;
  userRole: UserRole;
  onInventoryUpdated: () => void;
}

const ACTIONABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'SURGE_STOCKOUT_SQUEEZE',
  'STOCKOUT_IMMINENT',
  'ACCELERATING_DEPLETION',
  'UNPROTECTED_DEMAND_SPIKE',
]);

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'var(--status-error)',
  HIGH: 'var(--status-pending)',
  MEDIUM: 'var(--accent-cyan)',
  LOW: 'var(--text-secondary)',
  HEALTHY: 'var(--status-success)',
};

const STATE_META: Record<RiskState, { label: string; color: string; bg: string; border: string; icon: string }> = {
  OPEN: {
    label: 'Open',
    color: 'var(--status-error)',
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.35)',
    icon: '⚠',
  },
  ACKNOWLEDGED: {
    label: 'Acknowledged',
    color: 'var(--status-pending)',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.35)',
    icon: '👁',
  },
  RESOLVED: {
    label: 'Resolved',
    color: 'var(--status-success)',
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.35)',
    icon: '✓',
  },
  DISMISSED: {
    label: 'Dismissed',
    color: 'var(--text-muted)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    icon: '—',
  },
};

// ─── State Badge Component ────────────────────────────────────────────────────

const StateBadge: React.FC<{ state: RiskState }> = ({ state }) => {
  const meta = STATE_META[state] ?? STATE_META.OPEN;
  return (
    <span
      style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.border}`,
        borderRadius: '4px',
        padding: '0.15rem 0.5rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}
    >
      <span>{meta.icon}</span>
      {meta.label.toUpperCase()}
    </span>
  );
};

// ─── History Tab ──────────────────────────────────────────────────────────────

const RiskActionHistory: React.FC<{ actions: RiskAction[]; loading: boolean; error: string | null }> = ({
  actions,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <p style={{ color: 'var(--accent-cyan)', textAlign: 'center', padding: '1.5rem' }}>
        Loading audit history…
      </p>
    );
  }
  if (error) {
    return (
      <div
        style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          padding: '1rem',
        }}
      >
        <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>⚠ {error}</p>
      </div>
    );
  }
  if (actions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        No action history recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {actions.map((a) => {
        const meta = STATE_META[(a.state as RiskState)] ?? STATE_META.OPEN;
        const ts = new Date(a.created_at).toLocaleString(undefined, {
          dateStyle: 'short',
          timeStyle: 'short',
        });
        return (
          <div
            key={a.id}
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${meta.border}`,
              borderRadius: '7px',
              padding: '0.8rem 1rem',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '0.5rem',
              alignItems: 'start',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                <StateBadge state={a.state as RiskState} />
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(100,220,255,0.06)',
                    borderRadius: '3px',
                    padding: '0.1rem 0.35rem',
                  }}
                >
                  {a.risk_category}
                </span>
                {a.product_id != null && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    product #{a.product_id}
                  </span>
                )}
              </div>
              {a.action_note && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: '1.4' }}>
                  "{a.action_note}"
                </p>
              )}
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.3rem 0 0', fontFamily: 'monospace' }}>
                fp: {a.risk_fingerprint.slice(0, 12)}…
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              <div>{a.user_email ?? 'system'}</div>
              <div>{ts}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Action Modal ─────────────────────────────────────────────────────────────

type ModalTransition = 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';

interface ActionModalProps {
  item: PrioritizedRiskAction;
  currentQty: number;
  reorderLevel: number;
  onClose: () => void;
  onCompleted: (msg: string) => void;
}

const TRANSITION_META: Record<ModalTransition, { label: string; color: string; btnClass: string; description: string; inventoryHint?: string }> = {
  ACKNOWLEDGED: {
    label: 'Acknowledge',
    color: 'var(--status-pending)',
    btnClass: 'btn-acknowledge',
    description: 'Mark this risk as seen and under review. It remains visible in the active queue.',
    inventoryHint: undefined,
  },
  RESOLVED: {
    label: 'Resolve + Adjust Stock',
    color: 'var(--status-success)',
    btnClass: 'btn-resolve',
    description:
      'Record this risk as resolved. Optionally adjust inventory — stock adjustment is performed after the action record is created and kept even if inventory fails.',
    inventoryHint: 'Stock adjustment (optional)',
  },
  DISMISSED: {
    label: 'Dismiss',
    color: 'var(--text-muted)',
    btnClass: 'btn-dismiss',
    description:
      'Dismiss this risk for 7 days. It will auto-reopen if still detected after the grace period.',
    inventoryHint: undefined,
  },
};

const ActionModal: React.FC<ActionModalProps> = ({ item, currentQty, reorderLevel, onClose, onCompleted }) => {
  const [transition, setTransition] = useState<ModalTransition>('ACKNOWLEDGED');
  const [actionNote, setActionNote] = useState('');
  const [adjustStock, setAdjustStock] = useState(false);
  const [newQty, setNewQty] = useState(String(currentQty));
  const [newReorder, setNewReorder] = useState(String(reorderLevel));
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [patchWarning, setPatchWarning] = useState<string | null>(null);

  const meta = TRANSITION_META[transition];
  const showInventory = transition === 'RESOLVED' && item.product_id != null && ACTIONABLE_CATEGORIES.has(item.risk_category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    setPatchWarning(null);

    // ── Step 1: record action (always first) ──────────────────────────────────
    const payload: RiskActionCreate = {
      risk_fingerprint: item.risk_fingerprint,
      product_id: item.product_id ?? undefined,
      risk_category: item.risk_category,
      state: transition as RiskState,
      action_note: actionNote.trim() || undefined,
      metrics_snapshot: {},
    };

    try {
      await recordRiskAction(payload);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Failed to record action.');
      setModalError(msg);
      setSubmitting(false);
      return;
    }

    // ── Step 2: inventory PATCH (optional, only for RESOLVED + adjustStock) ───
    let successNote = `${transition} recorded for ${item.product_name ?? 'risk'}.`;
    if (showInventory && adjustStock) {
      const parsedQty = parseInt(newQty, 10);
      const parsedReorder = parseInt(newReorder, 10);
      if (!isNaN(parsedQty) && parsedQty >= 0 && !isNaN(parsedReorder) && parsedReorder >= 0 && item.product_id != null) {
        try {
          const invPayload: InventoryUpdateRequest = { quantity: parsedQty, reorder_level: parsedReorder };
          await updateInventory(item.product_id, invPayload);
          successNote += ` Inventory updated: qty=${parsedQty}, reorder=${parsedReorder}.`;
        } catch (patchErr) {
          // PATCH failed — action record is already persisted. Surface warning but continue.
          const patchMsg = patchErr instanceof ApiError ? patchErr.message : (patchErr instanceof Error ? patchErr.message : 'Inventory adjustment failed.');
          setPatchWarning(patchMsg);
          setSubmitting(false);
          // Close modal later so user sees the warning — notify parent that action record succeeded
          onCompleted(`Action recorded. ⚠ Stock adjustment failed: ${patchMsg}`);
          return;
        }
      }
    }

    setSubmitting(false);
    onCompleted(successNote);
  };

  return (
    <div className="auth-modal-overlay" onClick={submitting ? undefined : onClose}>
      <div
        className="auth-modal"
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Action Risk
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {item.product_name ?? 'Business-wide risk'} · {item.risk_category}
            </p>
          </div>
          <button
            id="close-action-modal-btn"
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '1.3rem', cursor: submitting ? 'not-allowed' : 'pointer', padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Current State Context */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0.7rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong>Current state:</strong>
            </span>
            {' '}
            <StateBadge state={item.current_state as RiskState} />
          </div>
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
        </div>

        {/* Impact */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Impact: </strong>{item.impact_summary}
        </div>

        {/* Guidance */}
        <div
          style={{
            background: 'rgba(100,220,255,0.05)',
            borderLeft: '3px solid var(--accent-cyan)',
            borderRadius: '0 6px 6px 0',
            padding: '0.6rem 0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
            Advisory:
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            {item.recommended_action}
          </div>
        </div>

        {/* Transition Selector */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            SELECT TRANSITION
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as ModalTransition[]).map((t) => {
              const tm = TRANSITION_META[t];
              const isSelected = transition === t;
              return (
                <button
                  key={t}
                  id={`transition-${t.toLowerCase()}-btn`}
                  type="button"
                  onClick={() => { setTransition(t); setModalError(null); setPatchWarning(null); }}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.6rem',
                    borderRadius: '5px',
                    border: isSelected ? `2px solid ${tm.color}` : '1px solid var(--border-color)',
                    background: isSelected ? `${tm.color}18` : 'rgba(255,255,255,0.03)',
                    color: isSelected ? tm.color : 'var(--text-secondary)',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tm.label}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
            {meta.description}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Note */}
          <div className="auth-field">
            <label htmlFor="action-note">
              Note <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <input
              id="action-note"
              type="text"
              placeholder="e.g. Restock ordered, supplier confirmed ETA…"
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          {/* Inventory fields — only shown for RESOLVED + actionable product */}
          {showInventory && (
            <div
              style={{
                marginTop: '0.75rem',
                background: 'rgba(34,197,94,0.04)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
              }}
            >
              <label
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                <input
                  id="adjust-stock-toggle"
                  type="checkbox"
                  checked={adjustStock}
                  onChange={(e) => setAdjustStock(e.target.checked)}
                  disabled={submitting}
                />
                Also adjust inventory levels (optional)
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0', lineHeight: '1.3' }}>
                Action record is saved first — if the stock update fails, the action record is kept and the error is surfaced.
              </p>

              {adjustStock && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="auth-field" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label htmlFor="resolve-quantity" style={{ fontSize: '0.8rem' }}>New Quantity *</label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current: {currentQty}</span>
                    </div>
                    <input
                      id="resolve-quantity"
                      type="number"
                      step="1"
                      min="0"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="auth-field" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label htmlFor="resolve-reorder" style={{ fontSize: '0.8rem' }}>New Reorder Level *</label>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current: {reorderLevel}</span>
                    </div>
                    <input
                      id="resolve-reorder"
                      type="number"
                      step="1"
                      min="0"
                      value={newReorder}
                      onChange={(e) => setNewReorder(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Errors / Warnings */}
          {modalError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                color: 'var(--status-error)',
                fontSize: '0.85rem',
                marginTop: '0.75rem',
              }}
            >
              ⚠ {modalError}
            </div>
          )}
          {patchWarning && (
            <div
              style={{
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                color: 'var(--status-pending)',
                fontSize: '0.85rem',
                marginTop: '0.75rem',
              }}
            >
              ⚠ Action recorded, but inventory update failed: {patchWarning}
            </div>
          )}

          {/* Submit Row */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              id="submit-risk-action-btn"
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
              style={{ flex: 2, margin: 0, background: meta.color, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Recording…' : meta.label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const CrossDomainRiskPanel: React.FC<CrossDomainRiskPanelProps> = ({
  days = 30,
  userRole,
  onInventoryUpdated,
}) => {
  type Tab = 'active' | 'history';
  const [activeTab, setActiveTab] = useState<Tab>('active');

  // Active tab state
  const [priorities, setPriorities] = useState<PrioritizedRiskAction[]>([]);
  const [correlations, setCorrelations] = useState<CrossDomainRiskCorrelation[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [errorActive, setErrorActive] = useState<string | null>(null);

  // History tab state
  const [actions, setActions] = useState<RiskAction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  // Action modal state
  const [actionTarget, setActionTarget] = useState<PrioritizedRiskAction | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const canMutate = userRole === 'OWNER' || userRole === 'ADMIN';

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getSupportingMetrics = (item: PrioritizedRiskAction) => {
    const matchingCorr =
      correlations.find((c) => c.product_id === item.product_id && c.correlation_type === item.risk_category) ||
      correlations.find((c) => c.product_id === item.product_id);

    const rawQty =
      (item as any).supporting_metrics?.current_quantity ??
      matchingCorr?.supporting_metrics?.current_quantity ??
      0;
    const rawReorder =
      (item as any).supporting_metrics?.reorder_level ??
      matchingCorr?.supporting_metrics?.reorder_level ??
      0;

    const currentQty = Math.max(0, isNaN(Number(rawQty)) ? 0 : Number(rawQty));
    const reorderLevel = Math.max(0, isNaN(Number(rawReorder)) ? 0 : Number(rawReorder));
    return { currentQty, reorderLevel };
  };

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadActive = useCallback(async () => {
    let isMounted = true;
    setLoadingActive(true);
    setErrorActive(null);
    try {
      const [pRes, cRes] = await Promise.all([
        fetchRiskPriorities(days, false),
        fetchCrossDomainRisks(days),
      ]);
      if (isMounted) {
        setPriorities(pRes);
        setCorrelations(cRes);
      }
    } catch (err) {
      if (isMounted) {
        setErrorActive(err instanceof Error ? err.message : 'Error fetching cross-domain risks');
      }
    } finally {
      if (isMounted) setLoadingActive(false);
    }
    return () => { isMounted = false; };
  }, [days]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setErrorHistory(null);
    try {
      const res = await fetchRiskActions({ limit: 200 });
      setActions(res);
    } catch (err) {
      setErrorHistory(err instanceof Error ? err.message : 'Error fetching action history');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  // ── Modal handlers ─────────────────────────────────────────────────────────

  const handleOpenAction = (item: PrioritizedRiskAction) => {
    if (!canMutate) return;
    setActionTarget(item);
  };

  const handleActionCompleted = async (msg: string) => {
    setActionTarget(null);
    showSuccess(msg);
    // Reload active queue so state badges and suppression refresh
    await loadActive();
    // Notify parent (e.g. inventory panel refresh if stock was also adjusted)
    onInventoryUpdated();
  };

  // ── Tab Styles ─────────────────────────────────────────────────────────────

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '0.4rem 1rem',
    borderRadius: '5px 5px 0 0',
    border: 'none',
    cursor: 'pointer',
    fontWeight: activeTab === tab ? 700 : 500,
    fontSize: '0.85rem',
    background: activeTab === tab ? 'rgba(100,220,255,0.12)' : 'transparent',
    color: activeTab === tab ? 'var(--accent-cyan)' : 'var(--text-secondary)',
    borderBottom: activeTab === tab ? '2px solid var(--accent-cyan)' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Priority Command Center */}
      <div className="card">
        {/* Card Header */}
        <div className="card-header">
          <div>
            <h2
              className="card-title"
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
            >
              <span>Operational Risk Command Center</span>
              {priorities.filter((p) => p.current_state === 'OPEN').length > 0 && activeTab === 'active' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(239,68,68,0.15)',
                    color: 'var(--status-error)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  {priorities.filter((p) => p.current_state === 'OPEN').length} Open
                </span>
              )}
              {priorities.filter((p) => p.current_state === 'ACKNOWLEDGED').length > 0 && activeTab === 'active' && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    background: 'rgba(245,158,11,0.12)',
                    color: 'var(--status-pending)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  {priorities.filter((p) => p.current_state === 'ACKNOWLEDGED').length} Acknowledged
                </span>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              <strong>What requires attention now, and why?</strong> Deterministic multi-domain risk ranking with persistent lifecycle actioning.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>Phase 3B + M5-S4</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <button id="tab-active-risks" type="button" style={tabStyle('active')} onClick={() => setActiveTab('active')}>
            Active Risks
          </button>
          <button id="tab-action-history" type="button" style={tabStyle('history')} onClick={() => setActiveTab('history')}>
            Action History
            {actions.length > 0 && (
              <span
                style={{
                  marginLeft: '0.4rem',
                  fontSize: '0.65rem',
                  background: 'rgba(100,220,255,0.12)',
                  color: 'var(--accent-cyan)',
                  borderRadius: '10px',
                  padding: '0.1rem 0.4rem',
                  fontWeight: 700,
                }}
              >
                {actions.length}
              </span>
            )}
          </button>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div
            style={{
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              color: 'var(--status-success)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✓</span>
            <span>{successBanner}</span>
          </div>
        )}

        {/* ── Active Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'active' && (
          <>
            {loadingActive && (
              <p style={{ color: 'var(--accent-cyan)', textAlign: 'center', padding: '1.5rem' }}>
                Evaluating cross-domain risk collisions and priority ranking…
              </p>
            )}
            {errorActive && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <p style={{ color: 'var(--status-error)', fontSize: '0.875rem', margin: 0 }}>⚠ {errorActive}</p>
              </div>
            )}
            {!loadingActive && priorities.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--status-success)', fontSize: '1.1rem', fontWeight: 600 }}>
                  ✓ All Operational Domains Operating Within Normal Parameters
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  No critical inventory deficits or unmitigated demand collisions detected.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {priorities.map((item) => {
                const stateM = STATE_META[item.current_state as RiskState] ?? STATE_META.OPEN;
                const isActionable = ACTIONABLE_CATEGORIES.has(item.risk_category) && item.product_id != null;
                const isSupressed = item.current_state === 'RESOLVED' || item.current_state === 'DISMISSED';

                return (
                  <div
                    key={item.priority_rank}
                    style={{
                      background: isSupressed ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${
                        isSupressed
                          ? 'rgba(255,255,255,0.08)'
                          : item.severity === 'CRITICAL'
                          ? 'rgba(239,68,68,0.45)'
                          : item.severity === 'HIGH'
                          ? 'rgba(245,158,11,0.45)'
                          : 'var(--border-color)'
                      }`,
                      borderRadius: '8px',
                      padding: '1.25rem',
                      position: 'relative',
                      opacity: isSupressed ? 0.7 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {/* Header row */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            background:
                              item.severity === 'CRITICAL'
                                ? 'var(--status-error)'
                                : item.severity === 'HIGH'
                                ? 'var(--status-pending)'
                                : 'var(--accent-cyan)',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {/* State Badge */}
                        <StateBadge state={item.current_state as RiskState} />

                        {item.affected_domains.map((dom) => (
                          <span
                            key={dom}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: 'rgba(255,255,255,0.05)',
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
                            background: 'rgba(100,220,255,0.08)',
                            borderRadius: '4px',
                            padding: '0.15rem 0.5rem',
                          }}
                        >
                          Score: {item.priority_score.toFixed(1)}/100
                        </span>
                      </div>
                    </div>

                    {/* Last action note (if any) */}
                    {item.last_action_note && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: stateM.color,
                          background: stateM.bg,
                          border: `1px solid ${stateM.border}`,
                          borderRadius: '5px',
                          padding: '0.35rem 0.65rem',
                          marginBottom: '0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{stateM.icon}</span>
                        <span>{item.last_action_note}</span>
                        {item.last_actioned_at && (
                          <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            {new Date(item.last_actioned_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Impact */}
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                      <strong>Impact:</strong> {item.impact_summary}
                    </p>

                    {/* Recommended Action */}
                    <div
                      style={{
                        background: 'rgba(100,220,255,0.04)',
                        borderLeft: '3px solid var(--accent-cyan)',
                        padding: '0.6rem 0.9rem',
                        borderRadius: '0 6px 6px 0',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>DIRECT ACTION: </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{item.recommended_action}</span>
                    </div>

                    {/* Supporting Facts */}
                    {item.supporting_facts.length > 0 && (
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>
                          VERIFIED SOURCE FACTS (SQLite)
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

                    {/* Action Button Row */}
                    {isActionable && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.75rem',
                        }}
                      >
                        {canMutate ? (
                          <button
                            id={`action-risk-btn-${item.priority_rank}`}
                            type="button"
                            onClick={() => handleOpenAction(item)}
                            style={{
                              background:
                                item.current_state === 'OPEN'
                                  ? 'var(--status-error)'
                                  : item.current_state === 'ACKNOWLEDGED'
                                  ? 'var(--status-pending)'
                                  : 'rgba(255,255,255,0.08)',
                              color: item.current_state === 'DISMISSED' ? 'var(--text-secondary)' : '#0d1117',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.4rem 0.9rem',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              transition: 'all 0.15s',
                            }}
                          >
                            <span>
                              {item.current_state === 'OPEN'
                                ? '⚡ Action Risk'
                                : item.current_state === 'ACKNOWLEDGED'
                                ? '↗ Update Status'
                                : '↺ Re-action'}
                            </span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '0.3rem 0.6rem',
                            }}
                          >
                            Member · View Only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── History Tab ────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <RiskActionHistory actions={actions} loading={loadingHistory} error={errorHistory} />
        )}
      </div>

      {/* Cross-Domain Multi-Signal Correlation Matrix (Phase 3A) */}
      {correlations.length > 0 && activeTab === 'active' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Cross-Domain Risk Correlations</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Multi-domain signal collisions (Inventory × Demand Momentum × Revenue)
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)' }}>Phase 3A Matrix</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}
            >
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
                  <tr key={c.correlation_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                      {c.product_name}
                      {c.sku && (
                        <span style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {c.sku}
                        </span>
                      )}
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
                              background: 'rgba(255,255,255,0.05)',
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

      {/* Action Modal */}
      {actionTarget && (
        <ActionModal
          item={actionTarget}
          currentQty={getSupportingMetrics(actionTarget).currentQty}
          reorderLevel={getSupportingMetrics(actionTarget).reorderLevel}
          onClose={() => setActionTarget(null)}
          onCompleted={handleActionCompleted}
        />
      )}
    </div>
  );
};
