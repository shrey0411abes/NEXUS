import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  History,
  Search,
  RotateCw,
  ArrowRight,
  Filter,
  ShieldCheck,
  User,
  Clock,
  FileText,
  Tag,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatePill from '../components/StatePill.jsx'
import { fetchRiskActions } from '../api.js'

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const now = new Date()
  const diffSec = Math.floor((now - date) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ActivityPage({ onToggleMobileMenu }) {
  const [actions, setActions] = useState({ loading: true, error: null, data: [] })
  const [stateFilter, setStateFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const loadActions = useCallback(async () => {
    setActions((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchRiskActions({ limit: 100 })
      setActions({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setActions({
        loading: false,
        error: err.message || 'Unable to retrieve operational risk action records.',
        data: [],
      })
    }
  }, [])

  useEffect(() => {
    loadActions()
  }, [loadActions])

  const filteredActions = useMemo(() => {
    return actions.data.filter((act) => {
      if (stateFilter !== 'ALL' && act.state !== stateFilter) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const categoryMatch = act.risk_category?.toLowerCase().includes(query)
        const noteMatch = act.action_note?.toLowerCase().includes(query)
        const actorMatch = act.user_email?.toLowerCase().includes(query)
        const fingerprintMatch = act.risk_fingerprint?.toLowerCase().includes(query)
        return categoryMatch || noteMatch || actorMatch || fingerprintMatch
      }
      return true
    })
  }, [actions.data, stateFilter, searchQuery])

  return (
    <>
      <Topbar
        title="OPERATIONAL AUDIT STREAM"
        subtitle="Chronological audit history of risk lifecycle state transitions."
        onRefresh={loadActions}
        isRefreshing={actions.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--resolved)', fontWeight: 600 }}>
                AUDITABILITY & COMPLIANCE
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                IMMUTABLE AUDIT LOG
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {actions.data.length} LOGGED TRANSITIONS
              </span>
            </div>
            <h1 className="command-header-title">Operational Audit Stream</h1>
            <p className="command-header-desc">
              Authoritative chronological record of all state transitions, user acknowledgements, and audit memoranda recorded in SQLite.
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadActions}
              disabled={actions.loading}
            >
              <RotateCw size={13} className={actions.loading ? 'spin-anim' : ''} />
              <span>Sync Stream</span>
            </button>
            <Link to="/risk-queue" className="btn-command-action primary">
              <span>Risk Queue</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* ── Filter Controls ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStateFilter(st)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: stateFilter === st ? 'var(--brand)' : 'transparent',
                  color: stateFilter === st ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by actor, note, category..."
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
                width: 240,
              }}
            />
          </div>
        </div>

        {/* ── Visual Timeline Stream ──────────────────────────────────── */}
        {actions.loading ? (
          <div className="state-box">Loading immutable audit stream records…</div>
        ) : actions.error ? (
          <div className="state-box error">
            <span>{actions.error}</span>
            <button type="button" className="btn-retry" onClick={loadActions}>Retry</button>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="card">
            <div className="empty-state">No matching audit events found.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredActions.map((act) => (
              <div
                key={act.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: '180px 1fr 140px',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                {/* 1. STATE & CATEGORY */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatePill state={act.state} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'capitalize' }}>
                    {act.risk_category?.replaceAll('_', ' ') || 'Action'}
                  </span>
                  {act.product_id != null && (
                    <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)' }}>
                      Product P{act.product_id}
                    </span>
                  )}
                </div>

                {/* 2. MEMORANDUM & SCOPE */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    <User size={12} />
                    <span>Actor: <strong style={{ color: 'var(--text-secondary)' }}>{act.user_email || 'System Daemon'}</strong></span>
                  </div>
                  <div style={{ fontSize: 13, color: act.action_note ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: act.action_note ? 'normal' : 'italic' }}>
                    {act.action_note ? `“${act.action_note}”` : 'No audit note attached.'}
                  </div>
                  {act.risk_fingerprint && (
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                      Fingerprint: {act.risk_fingerprint}
                    </span>
                  )}
                </div>

                {/* 3. TIMESTAMPS */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatRelativeTime(act.created_at)}
                  </span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {formatDateTime(act.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}
