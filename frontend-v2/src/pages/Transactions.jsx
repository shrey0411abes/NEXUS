import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Receipt,
  RotateCw,
  Search,
  Calendar,
  DollarSign,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import { fetchTransactions } from '../api.js'

function formatCurrency(val) {
  if (val == null || isNaN(Number(val))) return '—'
  const n = Number(val)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Transactions({ onToggleMobileMenu }) {
  const [transactions, setTransactions] = useState({ loading: true, error: null, data: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const loadTransactions = useCallback(async () => {
    setTransactions((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchTransactions(200, 0)
      setTransactions({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setTransactions({
        loading: false,
        error: err.message || 'Unable to load transaction records.',
        data: [],
      })
    }
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  // Summaries from authoritative backend fields
  const summary = useMemo(() => {
    const list = transactions.data || []
    let totalGross = 0
    let totalItems = 0

    list.forEach((t) => {
      totalGross += Number(t.total_amount || 0)
      if (Array.isArray(t.items)) {
        totalItems += t.items.length
      }
    })

    const avgVal = list.length > 0 ? totalGross / list.length : 0

    return {
      count: list.length,
      gross: totalGross,
      avgVal,
      totalItems,
    }
  }, [transactions.data])

  // Chronological activity chart data (recent sorted)
  const chartData = useMemo(() => {
    if (!transactions.data || transactions.data.length === 0) return []
    const sorted = [...transactions.data]
      .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime())
      .slice(-16)

    return sorted.map((t) => ({
      name: `#${t.id}`,
      date: formatDateShort(t.transaction_date),
      amount: Number(t.total_amount || 0),
      itemsCount: Array.isArray(t.items) ? t.items.length : 1,
    }))
  }, [transactions.data])

  // Transaction type distribution donut
  const typeDonutData = useMemo(() => {
    const list = transactions.data || []
    if (list.length === 0) return []
    const counts = {}
    list.forEach((t) => {
      const type = (t.transaction_type || 'SALE').toUpperCase()
      counts[type] = (counts[type] || 0) + 1
    })

    const palette = {
      SALE: '#4f75ff',
      RETURN: '#ff4d5e',
      EXCHANGE: '#f5a623',
      ADJUSTMENT: '#00d2ff',
    }

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: palette[name] || '#64748b',
    }))
  }, [transactions.data])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return transactions.data.filter((t) => {
      if (typeFilter !== 'ALL' && t.transaction_type?.toUpperCase() !== typeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const idStr = String(t.id)
        const typeStr = (t.transaction_type || '').toLowerCase()
        const dateStr = (t.transaction_date || '').toLowerCase()
        return idStr.includes(q) || typeStr.includes(q) || dateStr.includes(q)
      }
      return true
    })
  }, [transactions.data, typeFilter, searchQuery])

  // Recent 5 transactions for event stream timeline
  const recentTimeline = useMemo(() => {
    if (!transactions.data || transactions.data.length === 0) return []
    return [...transactions.data]
      .sort((a, b) => new Date(b.created_at || b.transaction_date).getTime() - new Date(a.created_at || a.transaction_date).getTime())
      .slice(0, 5)
  }, [transactions.data])

  return (
    <>
      <Topbar
        title="TRANSACTION INTELLIGENCE WORKSPACE"
        subtitle="Immutable POS transactions and inventory movement activity."
        onRefresh={loadTransactions}
        isRefreshing={transactions.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)', fontWeight: 600 }}>
                ACTIVITY INTELLIGENCE
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                IMMUTABLE AUDIT STREAM
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {transactions.data.length} AUDIT RECORDS
              </span>
            </div>
            <h1 className="command-header-title">Transaction Intelligence Workspace</h1>
            <p className="command-header-desc">
              Authoritative point-of-sale and movement records. Backend-validated totals; zero client-side arithmetic.
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadTransactions}
              disabled={transactions.loading}
            >
              <RotateCw size={13} className={transactions.loading ? 'spin-anim' : ''} />
              <span>Sync Records</span>
            </button>
          </div>
        </div>

        {/* ── Analytical Metrics Strip ────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 18 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Transaction Count</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '4px 0 2px' }}>
              {summary.count}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Recorded events</span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(79, 117, 255, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--brand-light)' }}>Gross Activity Volume</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '4px 0 2px' }}>
              {formatCurrency(summary.gross)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Cumulative recorded value</span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(0, 210, 255, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--cyan)' }}>Average Transaction Value</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--cyan)', margin: '4px 0 2px' }}>
              {formatCurrency(summary.avgVal)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Per completed transaction</span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(0, 230, 118, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--resolved-light)' }}>Total Item Records</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--resolved-light)', margin: '4px 0 2px' }}>
              {summary.totalItems}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Line item movements</span>
          </div>
        </div>

        {/* ── Visual Analytics Section: Area Chart + Type Donut ─────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(280px, 340px)', gap: 20, marginBottom: 24 }}>

          {/* A. Chronological Value Stream Area Chart */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={15} color="var(--brand)" />
                  <h3>Transaction Value Stream</h3>
                </div>
                <div className="card-subtitle">
                  Time-series transaction totals verified from SQLite point-of-sale records
                </div>
              </div>
            </div>

            <div className="card-body" style={{ height: 230, padding: '14px 20px 4px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="txnGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f75ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#4f75ff" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      content={
                        <CustomChartTooltip
                          valueFormatter={(val) => formatCurrency(val)}
                          contextLabel="POS Transaction Total"
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Transaction Total"
                      stroke="#4f75ff"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#txnGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="state-box" style={{ height: '100%' }}>No stream data available</div>
              )}
            </div>
          </div>

          {/* B. Transaction Type Donut Chart */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={15} color="var(--cyan)" />
                  <h3>Type Composition</h3>
                </div>
                <div className="card-subtitle">
                  Activity by transaction classification
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: '14px 20px' }}>
              {typeDonutData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ width: '100%', height: 140, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={typeDonutData}
                          innerRadius={38}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {typeDonutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => `${val} events`}
                              contextLabel="Type Breakdown"
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
                        {transactions.data.length}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    {typeDonutData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontWeight: 600, color: item.color }}>
                            {item.value}
                          </span>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
                            {Math.round((item.value / (transactions.data.length || 1)) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="state-box">No type data</div>
              )}
            </div>
          </div>

        </div>

        {/* ── Chronological Event Timeline Stream ──────────────────────── */}
        {recentTimeline.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={15} color="var(--resolved)" />
                  <h3>Recent Audit Timeline</h3>
                </div>
                <div className="card-subtitle">
                  Live chronological sequence of point-of-sale event arrivals
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {recentTimeline.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-light)' }}>
                        #{t.id}
                      </span>
                      <span
                        className="pill"
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          background: (t.transaction_type || 'SALE').toUpperCase() === 'RETURN' ? 'rgba(255, 77, 94, 0.15)' : 'rgba(79, 117, 255, 0.15)',
                          color: (t.transaction_type || 'SALE').toUpperCase() === 'RETURN' ? 'var(--risk-light)' : 'var(--brand-light)',
                        }}
                      >
                        {t.transaction_type || 'SALE'}
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                      {formatCurrency(t.total_amount)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)' }}>
                      <span>{Array.isArray(t.items) ? `${t.items.length} items` : '1 item'}</span>
                      <span className="mono">{formatDateShort(t.transaction_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Table Filter Controls ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: typeFilter === 'ALL' ? 'var(--brand)' : 'transparent',
                color: typeFilter === 'ALL' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              All Types ({transactions.data.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SALE')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: typeFilter === 'SALE' ? 'rgba(79, 117, 255, 0.2)' : 'transparent',
                color: typeFilter === 'SALE' ? 'var(--brand-light)' : 'var(--text-secondary)',
              }}
            >
              Sales
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('RETURN')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: typeFilter === 'RETURN' ? 'rgba(255, 77, 94, 0.2)' : 'transparent',
                color: typeFilter === 'RETURN' ? 'var(--risk-light)' : 'var(--text-secondary)',
              }}
            >
              Returns
            </button>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search Txn ID, date, type..."
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
                width: 220,
              }}
            />
          </div>
        </div>

        {/* ── Transaction Records Table ───────────────────────────────── */}
        <div className="card">
          {transactions.loading ? (
            <div className="state-box">Loading immutable transaction records…</div>
          ) : transactions.error ? (
            <div className="state-box error">
              <span>{transactions.error}</span>
              <button type="button" className="btn-retry" onClick={loadTransactions}>Retry</button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state">No matching transaction records found.</div>
          ) : (
            <div className="table-scroll-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Txn ID</th>
                    <th style={{ width: 140 }}>Transaction Type</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Line Items</th>
                    <th style={{ width: 160, textAlign: 'right' }}>Authoritative Total</th>
                    <th style={{ width: 180 }}>Transaction Date</th>
                    <th>Recorded Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((t) => (
                    <tr key={t.id}>
                      <td className="cell-mono" style={{ color: 'var(--brand-light)' }}>
                        #{t.id}
                      </td>
                      <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {t.transaction_type || 'Sale'}
                      </td>
                      <td className="cell-mono" style={{ textAlign: 'right' }}>
                        {Array.isArray(t.items) ? t.items.length : '—'}
                      </td>
                      <td
                        className="cell-mono"
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: Number(t.total_amount) < 0 ? 'var(--risk-light)' : '#fff',
                        }}
                      >
                        {formatCurrency(t.total_amount)}
                      </td>
                      <td className="cell-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatDateTime(t.transaction_date)}
                      </td>
                      <td className="cell-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {formatDateTime(t.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card-footer">
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Total amounts authoritative from backend engine. No client-side recalculation.
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)' }}>
              Reconciled with SQLite
            </span>
          </div>
        </div>

      </div>
    </>
  )
}

