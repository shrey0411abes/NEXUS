import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  History,
  RotateCw,
  ArrowRight,
  ShieldCheck,
  User,
  Clock,
  Filter,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatePill from '../components/StatePill.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import {
  DataPanel,
  SectionHeader,
  CommandSurface,
  VerifiedBadge,
  TechnicalLabel,
  StatusIndicator,
  ActionButton,
  Timeline,
} from '../components/primitives/index.js'
import { fetchRiskActions } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

export default function ActivityPage({ onToggleMobileMenu }) {
  const { t, formatDateTime } = useI18n()
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

  // Map to Timeline items
  const timelineItems = useMemo(() => {
    return filteredActions.map((act) => ({
      id: act.id,
      title: act.risk_category ? act.risk_category.replaceAll('_', ' ') : 'System Verified Action',
      time: act.created_at ? formatDateTime(act.created_at) : '—',
      description: act.action_note || 'State transition recorded in SQLite database.',
      badge: <StatePill state={act.state} />,
      actor: act.user_email || 'Verified Tenant Admin',
      status: act.state === 'RESOLVED' ? 'action' : act.state === 'OPEN' ? 'risk' : 'verified',
      meta: act.risk_fingerprint ? `ID: ${act.risk_fingerprint.slice(0, 12)}…` : undefined,
    }))
  }, [filteredActions, formatDateTime])

  return (
    <ErrorBoundary>
      <Topbar
        title="OPERATIONAL AUDIT STREAM"
        subtitle="Chronological audit history of risk lifecycle state transitions."
        onRefresh={loadActions}
        isRefreshing={actions.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta="AUDITABILITY & COMPLIANCE"
          title="Operational Audit Stream"
          description="Authoritative chronological record of all state transitions, user acknowledgements, resolutions, and audit memoranda recorded in SQLite."
          badge={<VerifiedBadge />}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionButton
                variant="subtle"
                size="sm"
                icon={RotateCw}
                onClick={loadActions}
                loading={actions.loading}
              >
                Sync Stream
              </ActionButton>
              <Link to="/risk-queue">
                <ActionButton variant="primary" size="sm" icon={ArrowRight}>
                  Risk Queue
                </ActionButton>
              </Link>
            </div>
          }
        />

        {/* Command Surface Filter Controls */}
        <CommandSurface
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search audit events by category, note, or actor..."
          filters={[
            { id: 'all', label: 'ALL EVENTS', active: stateFilter === 'ALL', onClick: () => setStateFilter('ALL'), count: actions.data.length },
            { id: 'open', label: 'OPEN', active: stateFilter === 'OPEN', onClick: () => setStateFilter('OPEN') },
            { id: 'ack', label: 'ACKNOWLEDGED', active: stateFilter === 'ACKNOWLEDGED', onClick: () => setStateFilter('ACKNOWLEDGED') },
            { id: 'res', label: 'RESOLVED', active: stateFilter === 'RESOLVED', onClick: () => setStateFilter('RESOLVED') },
            { id: 'dis', label: 'DISMISSED', active: stateFilter === 'DISMISSED', onClick: () => setStateFilter('DISMISSED') },
          ]}
          metadata={`${filteredActions.length} AUDIT ENTRIES`}
        />

        {/* Main Timeline Card */}
        <DataPanel
          title="CHRONOLOGICAL AUDIT TRAIL"
          subtitle="Immutable SQLite-backed state change history"
          icon={History}
          badge={<TechnicalLabel value="APPEND ONLY" variant="cyan" size="xs" />}
        >
          <div style={{ padding: '24px 20px' }}>
            {actions.loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading audit events...
              </div>
            ) : filteredActions.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                No audit events matching current criteria.
              </div>
            ) : (
              <Timeline items={timelineItems} />
            )}
          </div>
        </DataPanel>
      </div>
    </ErrorBoundary>
  )
}
