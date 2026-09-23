import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  MessageSquareText,
  RotateCw,
  ArrowRight,
  Clock,
  ShieldCheck,
  Zap,
  Search,
  Sparkles,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import { fetchInvestigationHistory } from '../api.js'

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

export default function SavedInvestigations({ onToggleMobileMenu }) {
  const [history, setHistory] = useState({ loading: true, error: null, data: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState('ALL')
  const navigate = useNavigate()

  const loadHistory = useCallback(async () => {
    setHistory((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchInvestigationHistory(50, 0)
      setHistory({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setHistory({
        loading: false,
        error: err.message || 'Unable to retrieve investigation audit archive.',
        data: [],
      })
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Summaries
  const summary = useMemo(() => {
    const list = history.data || []
    const high = list.filter((i) => i.confidence === 'HIGH').length
    let totalDuration = 0
    list.forEach((i) => {
      totalDuration += Number(i.execution_duration_ms || 0)
    })
    const avgDuration = list.length > 0 ? Math.round(totalDuration / list.length) : 0
    return {
      total: list.length,
      high,
      avgDuration,
    }
  }, [history.data])

  // Filtered investigations
  const filteredList = useMemo(() => {
    return history.data.filter((item) => {
      if (confidenceFilter !== 'ALL' && item.confidence !== confidenceFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const questionMatch = item.question?.toLowerCase().includes(q)
        const answerMatch = item.answer?.toLowerCase().includes(q)
        return questionMatch || answerMatch
      }
      return true
    })
  }, [history.data, confidenceFilter, searchQuery])

  return (
    <>
      <Topbar
        title="SAVED INVESTIGATIONS LIBRARY"
        subtitle="Knowledge retrieval archive of natural-language operational inquiries."
        onRefresh={loadHistory}
        isRefreshing={history.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 600 }}>
                KNOWLEDGE RETRIEVAL
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" style={{ background: 'var(--purple)', boxShadow: '0 0 6px var(--purple)' }} />
                PERSISTENT ARCHIVE
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {history.data.length} INQUIRIES ARCHIVED
              </span>
            </div>
            <h1 className="command-header-title">Personal Intelligence Library</h1>
            <p className="command-header-desc">
              Historical archive of executed natural language investigations, deterministic claim verifications, and calibrated confidence telemetry.
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadHistory}
              disabled={history.loading}
            >
              <RotateCw size={13} className={history.loading ? 'spin-anim' : ''} />
              <span>Refresh Library</span>
            </button>
            <Link to="/investigations" className="btn-command-action primary">
              <MessageSquareText size={14} />
              <span>New Investigation</span>
            </Link>
          </div>
        </div>

        {/* ── Metric Strip ────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 18 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Inquiries</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '4px 0 2px' }}>
              {summary.total}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Archived reasoning runs</span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(0, 230, 118, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--resolved-light)' }}>High Calibrated Confidence</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--resolved-light)', margin: '4px 0 2px' }}>
              {summary.high}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Strictly verified claims</span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(79, 117, 255, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--brand-light)' }}>Avg Execution Speed</span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--brand-light)', margin: '4px 0 2px' }}>
              {summary.avgDuration} ms
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>SQL query + LLM synthesis</span>
          </div>
        </div>

        {/* ── Filter Controls ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((conf) => (
              <button
                key={conf}
                type="button"
                onClick={() => setConfidenceFilter(conf)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: confidenceFilter === conf ? 'var(--brand)' : 'transparent',
                  color: confidenceFilter === conf ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {conf === 'ALL' ? 'All Confidence' : `${conf} Confidence`}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search past inquiries..."
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

        {/* ── Inquiry Cards Stream ────────────────────────────────────── */}
        {history.loading ? (
          <div className="state-box">Loading personal intelligence library…</div>
        ) : history.error ? (
          <div className="state-box error">
            <span>{history.error}</span>
            <button type="button" className="btn-retry" onClick={loadHistory}>Retry</button>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p style={{ margin: '0 0 12px' }}>No matching investigation inquiries in this view.</p>
              <Link to="/investigations" className="btn-command-action primary" style={{ display: 'inline-flex' }}>
                Launch New Inquiry
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredList.map((item) => (
              <div key={item.id} className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                      “{item.question}”
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span
                      className={`pill ${item.confidence === 'HIGH' ? 'resolved' : item.confidence === 'MEDIUM' ? 'acknowledged' : 'open'}`}
                    >
                      {item.confidence} CONFIDENCE
                    </span>
                    {item.verification_status && (
                      <span className="pill resolved">
                        {item.verification_status}
                      </span>
                    )}
                  </div>
                </div>

                {item.answer && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16, background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                    {item.answer}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={12} />
                      <span className="mono">{formatRelativeTime(item.created_at)}</span>
                      <span style={{ color: 'var(--text-faint)' }}>({formatDateTime(item.created_at)})</span>
                    </div>

                    {item.execution_duration_ms != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Zap size={12} color="var(--brand-light)" />
                        <span className="mono">{Math.round(item.execution_duration_ms)}ms</span>
                      </div>
                    )}

                    {item.provider && (
                      <div>
                        <span>Engine: <strong style={{ color: 'var(--text-secondary)' }}>{item.provider}</strong></span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/investigations?q=${encodeURIComponent(item.question)}`)}
                    className="btn-command-action secondary"
                    style={{ padding: '5px 12px', fontSize: 11.5 }}
                  >
                    <span>Re-Run Investigation</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}
