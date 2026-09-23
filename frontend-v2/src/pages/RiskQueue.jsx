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
  Search,
  Filter,
  RotateCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Layers,
  PieChart as PieIcon,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatePill from '../components/StatePill.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import RiskIntelligenceDrawer from '../components/RiskIntelligenceDrawer.jsx'
import { fetchRiskPriorities, fetchRiskActions, recordRiskAction } from '../api.js'

function timeAgo(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const hrs = Math.floor(diffMs / 3600000)
  if (hrs < 1) return 'just now'
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function RiskQueue({ onToggleMobileMenu }) {
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active') // 'active' | 'resolved' | 'history'
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [activeRisk, setActiveRisk] = useState(null)
  const [toast, setToast] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [priorities, actions] = await Promise.all([
        fetchRiskPriorities(50, true),
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
      { name: 'Open', value: openCount, color: '#ff4d5e' },
      { name: 'Acknowledged', value: ackCount, color: '#f5a623' },
      { name: 'Resolved', value: resCount, color: '#00e676' },
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
    return Object.entries(map).map(([name, count]) => ({
      name,
      count,
    })).sort((a, b) => b.count - a.count).slice(0, 4)
  }, [activeRisks])

  return (
    <>
      <Topbar
        title="RISK INTELLIGENCE QUEUE"
        subtitle="Prioritized operational risk collisions and state reconciliation."
        onRefresh={loadData}
        isRefreshing={loading}
        activeRiskCount={activeRisks.length}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--risk-light)', fontWeight: 600 }}>
                OPERATIONAL TRIAGE CONSOLE
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" style={{ background: 'var(--risk)', boxShadow: '0 0 6px var(--risk)' }} />
                {activeRisks.length} PENDING ATTENTION
              </span>
            </div>
            <h1 className="command-header-title">Priority Risk Queue</h1>
            <p className="command-header-desc">
              Deterministic cross-domain collisions reconciled against immutable action state in SQLite.
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadData}
              disabled={loading}
            >
              <RotateCw size={13} className={loading ? 'spin-anim' : ''} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* ── Visual Analytics Strip: State Donut + Category Breakdown ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: 20, marginBottom: 24 }}>

          {/* State Distribution Donut */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PieIcon size={15} color="var(--risk)" />
                  <h3>Risk State Breakdown</h3>
                </div>
                <div className="card-subtitle">
                  Lifecycle state distribution across {queue.length} evaluated risks
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: '16px 20px' }}>
              {stateDonutData.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 120, height: 120, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stateDonutData}
                          innerRadius={36}
                          outerRadius={56}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {stateDonutData.map((entry, index) => (
                            <Cell key={`state-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => `${val} risks`}
                              contextLabel="State"
                            />
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
                        {queue.length}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
                    {stateDonutData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: item.color }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="state-box">Loading states…</div>
              )}
            </div>
          </div>

          {/* Active Risk Category Distribution */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={15} color="var(--brand)" />
                  <h3>Active Category Distribution</h3>
                </div>
                <div className="card-subtitle">
                  Operational collision categories requiring priority intervention
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {categoryBarData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {categoryBarData.map((cat, idx) => {
                    const pct = Math.round((cat.count / (activeRisks.length || 1)) * 100)
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#fff' }}>
                            {cat.name}
                          </span>
                          <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                            {cat.count} risks ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: idx === 0 ? 'var(--risk)' : idx === 1 ? 'var(--ack)' : 'var(--brand)',
                              borderRadius: 'var(--radius-full)',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="state-box">No active category risks</div>
              )}
            </div>
          </div>

        </div>

        {/* ── Severity Distribution Triage Strip ──────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: '16px 20px' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Active Operational Risks
            </span>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: '#fff', margin: '4px 0 2px' }}>
              {severityCounts.total}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Awaiting resolution or acknowledgement
            </span>
          </div>

          <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(255, 77, 94, 0.2)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--risk-light)', letterSpacing: '0.05em' }}>
              High Severity Collisions
            </span>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--risk-light)', margin: '4px 0 2px' }}>
              {severityCounts.high}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Stockout and trapped revenue exposure
            </span>
          </div>

          <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(245, 166, 35, 0.2)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ack-light)', letterSpacing: '0.05em' }}>
              Medium Watch Collisions
            </span>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ack-light)', margin: '4px 0 2px' }}>
              {severityCounts.med}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Demand shifts & reorder proximity
            </span>
          </div>

          <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(0, 230, 118, 0.2)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--resolved-light)', letterSpacing: '0.05em' }}>
              Resolved / Dismissed
            </span>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--resolved-light)', margin: '4px 0 2px' }}>
              {resolvedRisks.length}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Lifecycle state reconciled
            </span>
          </div>
        </div>

        {/* ── Toast Notifications ─────────────────────────────────────── */}
        {toast && (
          <div
            className={`state-box ${toast.tone === 'error' ? 'error' : ''}`}
            style={{
              marginBottom: 20,
              padding: '12px 18px',
              fontSize: 12.5,
              borderColor: toast.tone === 'error' ? 'var(--risk)' : 'var(--resolved)',
              background: toast.tone === 'error' ? 'var(--risk-bg)' : 'var(--resolved-bg)',
              color: toast.tone === 'error' ? 'var(--risk-light)' : 'var(--resolved-light)',
            }}
          >
            {toast.text}
          </div>
        )}

        {/* ── Triage Navigation Tabs ──────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setTab('active')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12.5,
                fontWeight: 600,
                background: tab === 'active' ? 'var(--brand)' : 'transparent',
                color: tab === 'active' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Active Priorities ({activeRisks.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('resolved')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12.5,
                fontWeight: 600,
                background: tab === 'resolved' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: tab === 'resolved' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Resolved / Dismissed ({resolvedRisks.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12.5,
                fontWeight: 600,
                background: tab === 'history' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                color: tab === 'history' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              Audit History ({history.length})
            </button>
          </div>

          {/* Filters for active/resolved table */}
          {tab !== 'history' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter product, SKU, impact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 12px 6px 30px',
                    color: 'var(--text-primary)',
                    fontSize: 12.5,
                    outline: 'none',
                    width: 200,
                  }}
                />
              </div>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              >
                <option value="ALL">All Severities</option>
                <option value="HIGH">High Severity</option>
                <option value="MEDIUM">Medium Severity</option>
                <option value="LOW">Low Severity</option>
              </select>

              {/* Category filter */}
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 10px',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* ── Table Area ──────────────────────────────────────────────── */}
        {tab !== 'history' ? (
          <div className="card">
            {loading ? (
              <div className="state-box">Loading priority queue…</div>
            ) : filteredRows.length === 0 ? (
              <div className="empty-state">
                No matching operational risks in this view.
              </div>
            ) : (
              <div className="table-scroll-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Rank</th>
                      <th style={{ width: 100 }}>Severity</th>
                      <th style={{ width: 180 }}>Category</th>
                      <th style={{ width: 220 }}>Product / SKU</th>
                      <th style={{ width: 90 }}>State</th>
                      <th>Impact Summary</th>
                      <th style={{ width: 150 }}>Last Action</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => (
                      <tr
                        key={r.risk_fingerprint || r.id}
                        className="clickable"
                        onClick={() => setActiveRisk(r)}
                        title="Click to launch contextual intelligence drawer"
                      >
                        <td className="cell-mono" style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                          #{String(r.priority_rank ?? 1).padStart(2, '0')}
                        </td>
                        <td>
                          <span className={`severity ${r.severity ? r.severity.toLowerCase() : 'low'}`}>
                            {r.severity}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 12.5, textTransform: 'capitalize' }}>
                          {r.risk_category ? r.risk_category.replaceAll('_', ' ') : '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>
                            {r.product_name || 'Business Scope'}
                          </div>
                          {r.sku && (
                            <div className="cell-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {r.sku}
                            </div>
                          )}
                        </td>
                        <td>
                          <StatePill state={r.current_state} />
                        </td>
                        <td style={{ fontSize: 12, lineHeight: 1.4 }}>
                          {r.impact_summary}
                        </td>
                        <td className="cell-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {r.last_actioned_by ? (
                            <>
                              {r.last_actioned_by} · {timeAgo(r.last_actioned_at)}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-command-action secondary"
                            style={{ padding: '4px 10px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveRisk(r)
                            }}
                          >
                            Triage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card-footer">
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                Showing {filteredRows.length} of {currentDataset.length} risks in current view
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)' }}>
                Deterministic Ranking Engine
              </span>
            </div>
          </div>
        ) : (
          /* Audit History View */
          <div className="card">
            {history.length === 0 ? (
              <div className="empty-state">No audit transitions recorded yet.</div>
            ) : (
              <div className="table-scroll-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 170 }}>Timestamp</th>
                      <th style={{ width: 180 }}>Risk Category</th>
                      <th style={{ width: 120 }}>SKU</th>
                      <th style={{ width: 100 }}>State</th>
                      <th style={{ width: 150 }}>Actor</th>
                      <th>Memorandum Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="cell-mono" style={{ fontSize: 11.5 }}>
                          {new Date(h.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {h.risk_category?.replaceAll('_', ' ')}
                        </td>
                        <td className="cell-mono" style={{ color: 'var(--brand-light)' }}>
                          {h.sku || '—'}
                        </td>
                        <td>
                          <StatePill state={h.state} />
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {h.user_email || <span style={{ color: 'var(--text-muted)' }}>system</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {h.action_note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Contextual Risk Intelligence Drawer */}
      <RiskIntelligenceDrawer
        risk={activeRisk}
        onClose={() => setActiveRisk(null)}
        onActionSuccess={(updatedRisk) => {
          setQueue((prev) =>
            prev.map((r) =>
              (r.risk_fingerprint === updatedRisk.risk_fingerprint || r.id === updatedRisk.id)
                ? updatedRisk
                : r
            )
          )
          setToast({ text: `Transition to ${updatedRisk.current_state} recorded.`, tone: 'success' })
          setTimeout(() => setToast(null), 4000)
          loadData()
        }}
      />
    </>
  )
}
