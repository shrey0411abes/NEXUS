import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import {
  AlertTriangle,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  Sparkles,
  MessageSquareText,
  Filter,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatePill from '../components/StatePill.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import RiskIntelligenceDrawer from '../components/RiskIntelligenceDrawer.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import {
  DataPanel,
  Metric,
  SectionHeader,
  CommandSurface,
  VerifiedBadge,
  TechnicalLabel,
  StatusIndicator,
  ActionButton,
  Timeline,
} from '../components/primitives/index.js'
import { fetchRiskPriorities, fetchRiskActions, recordRiskAction } from '../api.js'
import ActionModal from '../components/ActionModal.jsx'
import { toast } from '../components/Toast.jsx'
import { useI18n } from '../i18n/index.jsx'
import { useNavigate } from 'react-router-dom'

export default function RiskQueue({ onToggleMobileMenu }) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active') // 'active' | 'resolved' | 'history'
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [activeRisk, setActiveRisk] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(null)
  const [actionModalRisk, setActionModalRisk] = useState(null)
  const [highlightedRisk, setHighlightedRisk] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [priorities, actions] = await Promise.all([
        fetchRiskPriorities(100, true),
        fetchRiskActions({ limit: 100 }),
      ])
      setQueue(Array.isArray(priorities) ? priorities : [])
      setHistory(Array.isArray(actions) ? actions : [])
    } catch (err) {
      // Keep existing state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const categories = useMemo(() => {
    const set = new Set()
    queue.forEach((r) => {
      if (r.risk_category) set.add(r.risk_category)
    })
    return Array.from(set)
  }, [queue])

  const activeRisks = useMemo(
    () => queue.filter((r) => r.current_state === 'OPEN' || r.current_state === 'ACKNOWLEDGED'),
    [queue],
  )

  const resolvedRisks = useMemo(
    () => queue.filter((r) => r.current_state === 'RESOLVED' || r.current_state === 'DISMISSED'),
    [queue],
  )

  // Filtered rows for current active or resolved view
  const currentDataset = tab === 'active' ? activeRisks : resolvedRisks
  const filteredRows = useMemo(() => {
    return currentDataset.filter((r) => {
      if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false
      if (categoryFilter !== 'ALL' && r.risk_category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const prod = (r.product_name || '').toLowerCase()
        const sku = (r.sku || '').toLowerCase()
        const cat = (r.risk_category || '').toLowerCase()
        const summary = (r.impact_summary || '').toLowerCase()
        return prod.includes(q) || sku.includes(q) || cat.includes(q) || summary.includes(q)
      }
      return true
    })
  }, [currentDataset, severityFilter, categoryFilter, searchQuery])

  // Severity counts
  const severityCounts = useMemo(() => {
    const high = activeRisks.filter((r) => r.severity === 'HIGH').length
    const med = activeRisks.filter((r) => r.severity === 'MEDIUM').length
    const low = activeRisks.filter((r) => r.severity === 'LOW').length
    return { high, med, low, total: activeRisks.length }
  }, [activeRisks])

  // State distribution donut data
  const stateDonutData = useMemo(() => {
    if (queue.length === 0) return []
    const openCount = queue.filter((r) => r.current_state === 'OPEN').length
    const ackCount = queue.filter((r) => r.current_state === 'ACKNOWLEDGED').length
    const resCount = queue.filter((r) => r.current_state === 'RESOLVED').length
    const disCount = queue.filter((r) => r.current_state === 'DISMISSED').length

    return [
      { name: 'Open', value: openCount, color: '#f43f5e' },
      { name: 'Acknowledged', value: ackCount, color: '#f59e0b' },
      { name: 'Resolved', value: resCount, color: '#10b981' },
      { name: 'Dismissed', value: disCount, color: '#64748b' },
    ].filter((item) => item.value > 0)
  }, [queue])

  // Category breakdown data
  const categoryBarData = useMemo(() => {
    if (activeRisks.length === 0) return []
    const map = {}
    activeRisks.forEach((r) => {
      const cat = (r.risk_category || 'OTHER').replaceAll('_', ' ')
      map[cat] = (map[cat] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [activeRisks])

  // Row highlight helper with state-matching
  const triggerRowHighlight = (id, targetState) => {
    setHighlightedRisk({ id, state: targetState })
    setTimeout(() => setHighlightedRisk(null), 2000)
  }

  // Quick triage handler from card
  const handleQuickTriage = async (e, risk, targetState) => {
    e.stopPropagation()
    const riskId = risk.risk_fingerprint || risk.id
    setActionInProgress(riskId)
    try {
      await recordRiskAction({
        risk_fingerprint: risk.risk_fingerprint,
        product_id: risk.product_id ?? null,
        risk_category: risk.risk_category,
        state: targetState,
        action_note: `Quick triage transition to ${targetState} from Risk Command Surface`,
      })
      // Update local state
      setQueue((prev) =>
        prev.map((r) =>
          (r.risk_fingerprint || r.id) === riskId ? { ...r, current_state: targetState } : r
        )
      )
      // State-matched row highlight (amber for ACK, teal for RESOLVED, muted for DISMISSED)
      triggerRowHighlight(riskId, targetState)
      toast.success(`Operational risk transitioned to ${targetState}.`, 'Action Recorded')
    } catch (err) {
      toast.error(err?.message || 'Quick triage transition failed.', 'Action Error')
    } finally {
      setActionInProgress(null)
    }
  }

  // ActionModal submission handler
  const handleActionModalSubmit = async (payload) => {
    if (!actionModalRisk) return
    const riskId = actionModalRisk.risk_fingerprint || actionModalRisk.id
    try {
      await recordRiskAction({
        risk_fingerprint: actionModalRisk.risk_fingerprint,
        product_id: actionModalRisk.product_id ?? null,
        risk_category: actionModalRisk.risk_category,
        state: payload.state,
        action_note: payload.note || `Transition to ${payload.state} via ActionModal`,
      })
      setQueue((prev) =>
        prev.map((r) =>
          (r.risk_fingerprint || r.id) === riskId ? { ...r, current_state: payload.state } : r
        )
      )
      // State-matched row highlight
      triggerRowHighlight(riskId, payload.state)
      toast.success(`Operational risk transitioned to ${payload.state}.`, 'Action Recorded')
    } catch (err) {
      toast.error(err?.message || 'Failed to record operational action.', 'Action Failed')
      throw err // Rethrow to trigger modal shake-on-failure
    }
  }

  // History timeline mapping
  const timelineItems = useMemo(() => {
    return history.map((act) => ({
      id: act.id,
      title: act.risk_category ? act.risk_category.replaceAll('_', ' ') : 'Risk Action',
      time: act.created_at ? formatDateTime(act.created_at) : '—',
      description: act.action_note || 'Lifecycle state updated',
      status: act.state === 'RESOLVED' ? 'action' : act.state === 'OPEN' ? 'risk' : 'neutral',
      badge: <StatePill state={act.state} />,
      actor: act.user_email || 'System Engine',
      meta: act.risk_fingerprint ? `ID: ${act.risk_fingerprint.slice(0, 10)}…` : undefined,
    }))
  }, [history, formatDateTime])

  return (
    <ErrorBoundary>
      <Topbar
        title={t('riskQueue.title')}
        subtitle={t('riskQueue.desc')}
        onRefresh={loadData}
        isRefreshing={loading}
        activeRiskCount={activeRisks.length}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta={t('riskQueue.meta')}
          title={t('riskQueue.title')}
          description={t('riskQueue.desc')}
          badge={<VerifiedBadge />}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionButton
                variant="subtle"
                size="sm"
                icon={RotateCw}
                onClick={loadData}
                loading={loading}
              >
                Sync Queue
              </ActionButton>
            </div>
          }
        />

        {/* ── Analytical Landscape Matrix ─────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Severity Metrics Card */}
          <DataPanel title="SEVERITY SPECTRUM" subtitle="Deterministic active risk counts" icon={AlertTriangle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: 10 }}>
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.08)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--risk-light)', textTransform: 'uppercase' }}>
                  CRITICAL HIGH
                </span>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--risk-light)', marginTop: 4 }}>
                  {severityCounts.high}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ack-light)', textTransform: 'uppercase' }}>
                  MODERATE
                </span>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ack-light)', marginTop: 4 }}>
                  {severityCounts.med}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--resolved-light)', textTransform: 'uppercase' }}>
                  LOW WATCH
                </span>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--resolved-light)', marginTop: 4 }}>
                  {severityCounts.low}
                </div>
              </div>
            </div>
          </DataPanel>

          {/* Risk State Distribution Donut */}
          <DataPanel title="RISK STATE TRIAGE" subtitle="Open vs Acknowledged vs Resolved" icon={ShieldCheck}>
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stateDonutData.length > 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 120, height: 100, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stateDonutData}
                          innerRadius={26}
                          outerRadius={44}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {stateDonutData.map((entry, index) => (
                            <Cell key={`state-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                    {stateDonutData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No queue records</span>
              )}
            </div>
          </DataPanel>

          {/* Category Distribution Bar */}
          <DataPanel title="ACTIVE CATEGORIES" subtitle="Top operational collision categories" icon={Layers}>
            <div style={{ height: 110 }}>
              {categoryBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBarData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="count" fill="var(--brand)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No active categories
                </div>
              )}
            </div>
          </DataPanel>
        </div>

        {/* ── Command Surface Controls ─────────────────────────────────── */}
        <CommandSurface
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Filter risk queue by SKU, product, or summary..."
          filters={[
            { id: 'all', label: 'ALL SEVERITIES', active: severityFilter === 'ALL', onClick: () => setSeverityFilter('ALL') },
            { id: 'high', label: 'CRITICAL HIGH', active: severityFilter === 'HIGH', onClick: () => setSeverityFilter('HIGH'), count: severityCounts.high },
            { id: 'med', label: 'MODERATE', active: severityFilter === 'MEDIUM', onClick: () => setSeverityFilter('MEDIUM'), count: severityCounts.med },
            { id: 'low', label: 'LOW WATCH', active: severityFilter === 'LOW', onClick: () => setSeverityFilter('LOW'), count: severityCounts.low },
          ]}
          metadata={`${filteredRows.length} RISKS MATCHING`}
          actions={
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0, 0, 0, 0.25)', padding: 3, borderRadius: 'var(--radius-xs)' }}>
              <button
                type="button"
                onClick={() => setTab('active')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  background: tab === 'active' ? 'var(--brand)' : 'transparent',
                  color: tab === 'active' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ACTIVE ({activeRisks.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('resolved')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  background: tab === 'resolved' ? 'var(--brand)' : 'transparent',
                  color: tab === 'resolved' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                RESOLVED ({resolvedRisks.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 600,
                  background: tab === 'history' ? 'var(--brand)' : 'transparent',
                  color: tab === 'history' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                AUDIT HISTORY ({history.length})
              </button>
            </div>
          }
        />

        {/* ── Main Risk Command Surface or Audit Timeline with 120ms Tab Crossfade ─ */}
        <div key={tab} className="tab-crossfade-panel">
          {tab === 'history' ? (
            <DataPanel title="RISK AUDIT HISTORY" subtitle="Chronological transition records" icon={Clock}>
              <div style={{ padding: '20px' }}>
                <Timeline items={timelineItems} />
              </div>
            </DataPanel>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16,
              }}
            >
            {loading ? (
              <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                Evaluating cross-domain risks...
              </div>
            ) : filteredRows.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                No risks matching the active filter criteria.
              </div>
            ) : (
              filteredRows.map((risk) => {
                const isSubmittingThis = actionInProgress === (risk.risk_fingerprint || risk.id)
                const isHigh = risk.severity === 'HIGH'
                const isHighlighted = highlightedRisk?.id === (risk.risk_fingerprint || risk.id)
                const highlightClass = isHighlighted
                  ? highlightedRisk.state === 'ACKNOWLEDGED'
                    ? 'row-highlight-ack'
                    : highlightedRisk.state === 'DISMISSED'
                    ? 'row-highlight-dismissed'
                    : 'row-highlight-resolved'
                  : ''

                return (
                  <div
                    key={risk.risk_fingerprint || risk.id}
                    onClick={() => setActiveRisk(risk)}
                    className={`nexus-risk-card ${highlightClass}`}
                    style={{
                      background: 'var(--bg-panel)',
                      border: isHigh
                        ? '1px solid rgba(244, 63, 94, 0.35)'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isHigh ? '0 0 16px rgba(244, 63, 94, 0.08)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = isHigh ? 'var(--risk-light)' : 'var(--cyan)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = isHigh ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-subtle)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {/* Top Row: Rank, Severity, State */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 2,
                              background: 'rgba(6, 182, 212, 0.15)',
                              color: 'var(--cyan)',
                            }}
                          >
                            RANK #{String(risk.priority_rank ?? 1).padStart(2, '0')}
                          </span>
                          <span className={`severity ${risk.severity ? risk.severity.toLowerCase() : 'medium'}`}>
                            {risk.severity}
                          </span>
                          <TechnicalLabel value={risk.risk_category?.replaceAll('_', ' ')} size="xs" variant="default" />
                        </div>
                        <StatePill state={risk.current_state} />
                      </div>

                      {/* Product Name & SKU */}
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '4px 0 2px 0' }}>
                        {risk.product_name || risk.sku || 'Business Operational Scope'}
                      </h3>
                      {risk.sku && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          SKU: <span style={{ color: 'var(--text-secondary)' }}>{risk.sku}</span>
                        </div>
                      )}

                      {/* Impact Summary */}
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, margin: '8px 0 0 0' }}>
                        {risk.impact_summary}
                      </p>
                    </div>

                    {/* Recommended Next Step Callout */}
                    {risk.recommended_action && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderLeft: '2px solid var(--brand-light)',
                          padding: '6px 10px',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}
                      >
                        <strong style={{ color: 'var(--text-primary)' }}>Recommended:</strong> {risk.recommended_action}
                      </div>
                    )}

                    {/* Bottom Actions: Direct Triage Buttons */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: 10,
                        marginTop: 4,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6 }}>
                        {risk.current_state === 'OPEN' && (
                          <ActionButton
                            variant="subtle"
                            size="sm"
                            loading={isSubmittingThis}
                            onClick={(e) => handleQuickTriage(e, risk, 'ACKNOWLEDGED')}
                          >
                            Acknowledge
                          </ActionButton>
                        )}
                        {(risk.current_state === 'OPEN' || risk.current_state === 'ACKNOWLEDGED') && (
                          <ActionButton
                            variant="cyan"
                            size="sm"
                            loading={isSubmittingThis}
                            onClick={(e) => handleQuickTriage(e, risk, 'RESOLVED')}
                          >
                            Resolve
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="subtle"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionModalRisk(risk)
                          }}
                        >
                          Triage Modal
                        </ActionButton>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          color: 'var(--cyan)',
                          fontWeight: 600,
                        }}
                      >
                        <span>Inspect Drawer</span>
                        <ArrowRight size={12} />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
        </div>

        {/* ActionModal with Enter/Exit Animation & Shake-on-Failure */}
        {actionModalRisk && (
          <ActionModal
            risk={actionModalRisk}
            onClose={() => setActionModalRisk(null)}
            onSubmit={handleActionModalSubmit}
          />
        )}

        {/* Contextual Intelligence Drawer with Progressive Disclosure */}
        {activeRisk && (
          <RiskIntelligenceDrawer
            risk={activeRisk}
            onClose={() => setActiveRisk(null)}
            onActionSuccess={(updatedRisk) => {
              const updatedId = updatedRisk.risk_fingerprint || updatedRisk.id
              setQueue((prev) =>
                prev.map((r) =>
                  (r.risk_fingerprint || r.id) === updatedId ? updatedRisk : r
                )
              )
              triggerRowHighlight(updatedId, updatedRisk.current_state)
              toast.success('Risk action updated successfully.', 'Drawer Action')
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
