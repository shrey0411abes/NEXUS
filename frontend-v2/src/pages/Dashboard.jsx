import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import {
  RotateCw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Receipt,
  MessageSquareText,
  Activity,
  Layers,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Package,
  Calendar,
  Zap,
  PieChart as PieIcon,
  Coins,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import StatePill from '../components/StatePill.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import RiskIntelligenceDrawer from '../components/RiskIntelligenceDrawer.jsx'
import IntelligencePipeline from '../components/IntelligencePipeline.jsx'
import GuidanceBanner from '../components/GuidanceBanner.jsx'
import GettingStartedCard from '../components/GettingStartedCard.jsx'
import { useI18n } from '../i18n/index.jsx'
import {
  fetchBusinessKPIs,
  fetchBusinessFinancialSummary,
  fetchRiskPriorities,
  fetchBusinessTrends,
  fetchRiskActions,
  fetchCurrentUser,
  getCachedUserContext,
} from '../api.js'

export default function Dashboard({ onToggleMobileMenu }) {
  const { t, formatCurrency, formatNumber, formatRelativeTime } = useI18n()
  const [kpis, setKpis] = useState({ loading: true, error: null, data: null })
  const [financial, setFinancial] = useState({ loading: true, error: null, data: null })
  const [risks, setRisks] = useState({ loading: true, error: null, data: [] })
  const [trends, setTrends] = useState({ loading: true, error: null, data: [] })
  const [activity, setActivity] = useState({ loading: true, error: null, data: [] })
  const [tenantContext, setTenantContext] = useState(getCachedUserContext())
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState(null)
  const navigate = useNavigate()

  // 1. Fetch Business Health KPIs
  const loadKPIs = useCallback(async () => {
    setKpis((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchBusinessKPIs(30)
      setKpis({ loading: false, error: null, data })
    } catch (err) {
      setKpis({ loading: false, error: err.message || 'Unable to load business health KPIs', data: null })
    }
  }, [])

  // 2. Fetch Financial Exposure Summary
  const loadFinancial = useCallback(async () => {
    setFinancial((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchBusinessFinancialSummary(30)
      setFinancial({ loading: false, error: null, data })
    } catch (err) {
      setFinancial({ loading: false, error: err.message || 'Unable to load financial exposure summary', data: null })
    }
  }, [])

  // 3. Fetch Priority Risk Queue
  const loadRisks = useCallback(async () => {
    setRisks((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchRiskPriorities(30, true) // Include resolved for donut visualization
      setRisks({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setRisks({ loading: false, error: err.message || 'Unable to load priority risks', data: [] })
    }
  }, [])

  // 4. Fetch Operational Demand Trends
  const loadTrends = useCallback(async () => {
    setTrends((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchBusinessTrends(14)
      setTrends({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setTrends({ loading: false, error: err.message || 'Unable to load operational trends', data: [] })
    }
  }, [])

  // 5. Fetch Recent Risk Actions
  const loadActivity = useCallback(async () => {
    setActivity((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchRiskActions({ limit: 6 })
      setActivity({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setActivity({ loading: false, error: err.message || 'Unable to load recent activity', data: [] })
    }
  }, [])

  // Global refresh coordinating all sections independently
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true)
    await Promise.allSettled([
      loadKPIs(),
      loadFinancial(),
      loadRisks(),
      loadTrends(),
      loadActivity(),
      fetchCurrentUser().then(setTenantContext).catch(() => {}),
    ])
    setLastRefreshed(new Date())
    setIsRefreshing(false)
  }, [loadKPIs, loadFinancial, loadRisks, loadTrends, loadActivity])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Active risks
  const activeRisksList = useMemo(() => {
    return (risks.data || []).filter((r) => r.current_state === 'OPEN' || r.current_state === 'ACKNOWLEDGED')
  }, [risks.data])

  // Risk severity distribution calculation for Risk Landscape
  const riskDistribution = useMemo(() => {
    const list = activeRisksList
    const high = list.filter((r) => r.severity === 'HIGH').length
    const med = list.filter((r) => r.severity === 'MEDIUM').length
    const low = list.filter((r) => r.severity === 'LOW').length
    const total = list.length || 1
    return {
      high,
      med,
      low,
      total: list.length,
      highPct: Math.round((high / total) * 100),
      medPct: Math.round((med / total) * 100),
      lowPct: Math.round((low / total) * 100),
    }
  }, [activeRisksList])

  // Risk State Donut Data
  const riskStateDonutData = useMemo(() => {
    const list = risks.data || []
    if (list.length === 0) return []
    const openCount = list.filter((r) => r.current_state === 'OPEN').length
    const ackCount = list.filter((r) => r.current_state === 'ACKNOWLEDGED').length
    const resCount = list.filter((r) => r.current_state === 'RESOLVED').length
    const disCount = list.filter((r) => r.current_state === 'DISMISSED').length

    return [
      { name: t('global.open'), value: openCount, color: '#ff4d5e' },
      { name: t('global.acknowledged'), value: ackCount, color: '#f5a623' },
      { name: t('global.resolved'), value: resCount, color: '#00e676' },
      { name: t('global.dismissed'), value: disCount, color: '#64748b' },
    ].filter((item) => item.value > 0)
  }, [risks.data, t])

  // Inventory Health Donut Data derived strictly from verified KPIs
  const inventoryHealthDonutData = useMemo(() => {
    if (!kpis.data) return []
    const total = kpis.data.active_products_count || 0
    const outStock = kpis.data.out_of_stock_products_count || 0
    const lowStock = kpis.data.low_stock_products_count || 0
    const healthyStock = Math.max(0, total - outStock - lowStock)

    return [
      { name: t('dashboard.inventoryHealth.healthyBuffer'), value: healthyStock, color: '#00e676' },
      { name: t('dashboard.inventoryHealth.lowStockAlert'), value: lowStock, color: '#f5a623' },
      { name: t('dashboard.inventoryHealth.depletedStockout'), value: outStock, color: '#ff4d5e' },
    ].filter((item) => item.value > 0)
  }, [kpis.data, t])

  // Financial Exposure Comparison Chart Data
  const financialExposureChartData = useMemo(() => {
    if (!financial.data) return []
    return [
      {
        name: t('dashboard.financialExposure.dailyExposure'),
        value: financial.data.total_daily_revenue_exposure || 0,
        color: '#ff4d5e',
      },
      {
        name: t('dashboard.financialExposure.projected7d'),
        value: financial.data.projected_7d_revenue_exposure || 0,
        color: '#f5a623',
      },
      {
        name: t('financial.projectionsTitle'),
        value: financial.data.projected_30d_revenue_exposure || 0,
        color: '#4f75ff',
      },
    ]
  }, [financial.data, t])

  // Pulse Chart Data
  const pulseChartData = useMemo(() => {
    if (!trends.data || trends.data.length === 0) return []
    return trends.data.slice(0, 8).map((t) => ({
      name: t.sku,
      product: t.product_name,
      recent: t.recent_avg_daily_sales,
      prior: t.prior_avg_daily_sales,
    }))
  }, [trends.data])

  return (
    <>
      <Topbar
        title={t('dashboard.title')}
        subtitle={t('dashboard.desc')}
        onRefresh={refreshAll}
        isRefreshing={isRefreshing}
        activeRiskCount={activeRisksList.length}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">
        {/* Contextual Guidance Banner for Business Owners */}
        <GuidanceBanner storageKey="dashboard" messageKey="guidance.riskGuidance" />

        {/* Honest Architecture & Data Flow Onboarding Component */}
        <GettingStartedCard />

        {/* ── 1. COMMAND HEADER ────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)', letterSpacing: '0.08em', fontWeight: 600 }}>
                {t('dashboard.meta')}
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                {t('global.deterministic')}
              </span>
              {lastRefreshed && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('dashboard.syncedAgo', { time: formatRelativeTime(lastRefreshed).toUpperCase() })}
                </span>
              )}
            </div>
            <h1 className="command-header-title">
              {tenantContext?.business_name
                ? t('dashboard.titleWithBusiness', { businessName: tenantContext.business_name })
                : t('dashboard.title')}
            </h1>
            <p className="command-header-desc">
              {t('dashboard.desc')}
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={refreshAll}
              disabled={isRefreshing}
            >
              <RotateCw size={13} className={isRefreshing ? 'spin-anim' : ''} />
              <span>{isRefreshing ? t('global.refreshing') : t('dashboard.syncMetrics')}</span>
            </button>
            <button
              type="button"
              className="btn-command-action primary"
              onClick={() => navigate('/investigations')}
            >
              <MessageSquareText size={14} />
              <span>{t('dashboard.askNexus')}</span>
            </button>
          </div>
        </div>

        {/* ── 2. BUSINESS PULSE (DOMINANT ANALYTICAL HERO) ─────────────── */}
        <section className="business-pulse-hero" aria-label={t('dashboard.pulse.label')}>
          <div className="pulse-header">
            <div className="pulse-label">
              <Zap size={14} />
              <span>{t('dashboard.pulse.label')}</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('dashboard.pulse.evaluationWindow', { days: kpis.data?.observation_period_days || 30 })}
            </div>
          </div>

          <div className="pulse-layout">
            <div className="pulse-primary-signal">
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('dashboard.pulse.revenueHeadline')}
              </span>
              <div className="pulse-revenue-large">
                {kpis.loading ? t('global.loading') : kpis.data?.total_revenue != null ? formatCurrency(kpis.data.total_revenue) : '—'}
              </div>

              <div className="pulse-metrics-inline">
                <div className="pulse-sub-metric">
                  <span className="pulse-sub-label">{t('dashboard.pulse.transactions')}</span>
                  <span className="pulse-sub-val">
                    {kpis.loading ? '…' : kpis.data?.total_transactions != null ? formatNumber(kpis.data.total_transactions) : '—'}
                  </span>
                </div>
                <div className="pulse-sub-metric">
                  <span className="pulse-sub-label">{t('dashboard.pulse.unitsSold')}</span>
                  <span className="pulse-sub-val">
                    {kpis.loading ? '…' : kpis.data?.total_units_sold != null ? formatNumber(kpis.data.total_units_sold) : '—'}
                  </span>
                </div>
                <div className="pulse-sub-metric">
                  <span className="pulse-sub-label">{t('dashboard.pulse.avgTransaction')}</span>
                  <span className="pulse-sub-val">
                    {kpis.loading ? '…' : kpis.data?.average_transaction_value != null ? formatCurrency(kpis.data.average_transaction_value) : '—'}
                  </span>
                </div>
                <div className="pulse-sub-metric">
                  <span className="pulse-sub-label">{t('dashboard.pulse.activeSkus')}</span>
                  <span className="pulse-sub-val">
                    {kpis.loading ? '…' : kpis.data?.active_products_count != null ? formatNumber(kpis.data.active_products_count) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Embedded Visual Trend Chart */}
            <div className="pulse-chart-wrap">
              {trends.loading ? (
                <div className="state-box" style={{ height: '100%' }}>{t('dashboard.pulse.calculatingVelocity')}</div>
              ) : pulseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pulseChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="recentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f75ff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#4f75ff" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="priorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d2ff" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#00d2ff" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}${t('global.perDay')}`}
                    />
                    <Tooltip
                      content={
                        <CustomChartTooltip
                          valueFormatter={(val) => `${Number(val).toFixed(2)} ${t('global.unitsPerDay')}`}
                          contextLabel={t('dashboard.pulse.velocityComparison')}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="recent"
                      name={t('dashboard.pulse.recentVelocity')}
                      stroke="#4f75ff"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#recentGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="prior"
                      name={t('dashboard.pulse.priorVelocity')}
                      stroke="#00d2ff"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      fillOpacity={1}
                      fill="url(#priorGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="state-box degraded" style={{ height: '100%' }}>
                  {t('dashboard.pulse.velocityUnavailable')}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 3. ASYMMETRIC GRID: RISK LANDSCAPE & FINANCIAL EXPOSURE ──── */}
        <div className="cmd-grid-asym">

          {/* RISK LANDSCAPE MODULE WITH DONUT & SEVERITY VISUALIZATION */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={15} color="var(--risk)" />
                  <h3>{t('dashboard.riskLandscape.title')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('dashboard.riskLandscape.subtitle')}
                </div>
              </div>
              <Link to="/risk-queue" className="action-link" style={{ fontSize: 12, color: 'var(--brand-light)' }}>
                <span>{t('dashboard.riskLandscape.queueLink')}</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {/* Severity Distribution Metric Bar */}
            <div className="risk-landscape-metrics">
              <div className="risk-stat-item">
                <span className="risk-stat-label">{t('dashboard.riskLandscape.activeTotal')}</span>
                <span className="risk-stat-val">{formatNumber(riskDistribution.total)}</span>
              </div>
              <div className="risk-stat-item">
                <span className="risk-stat-label">{t('dashboard.riskLandscape.criticalHigh')}</span>
                <span className="risk-stat-val risk">{formatNumber(riskDistribution.high)}</span>
              </div>
              <div className="risk-stat-item">
                <span className="risk-stat-label">{t('dashboard.riskLandscape.moderate')}</span>
                <span className="risk-stat-val ack">{formatNumber(riskDistribution.med)}</span>
              </div>
              <div className="risk-stat-item">
                <span className="risk-stat-label">{t('dashboard.riskLandscape.lowWatch')}</span>
                <span className="risk-stat-val resolved">{formatNumber(riskDistribution.low)}</span>
              </div>
            </div>

            {/* Visual Risk State Donut + Segmented Severity Bar Layout */}
            <div style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: '1fr 140px', gap: 16, alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  {t('dashboard.riskLandscape.activeSeverityProp')}
                </span>
                {riskDistribution.total > 0 && (
                  <div className="risk-distribution-bar" style={{ margin: '8px 0 12px' }} title="Severity proportion">
                    <div className="risk-dist-seg high" style={{ width: `${riskDistribution.highPct}%` }} />
                    <div className="risk-dist-seg med" style={{ width: `${riskDistribution.medPct}%` }} />
                    <div className="risk-dist-seg low" style={{ width: `${riskDistribution.lowPct}%` }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span><strong style={{ color: 'var(--risk-light)' }}>{t('dashboard.riskLandscape.highPct', { pct: riskDistribution.highPct })}</strong></span>
                  <span><strong style={{ color: 'var(--ack-light)' }}>{t('dashboard.riskLandscape.medPct', { pct: riskDistribution.medPct })}</strong></span>
                  <span><strong style={{ color: 'var(--resolved-light)' }}>{t('dashboard.riskLandscape.lowPct', { pct: riskDistribution.lowPct })}</strong></span>
                </div>
              </div>

              {/* Risk State Donut Chart */}
              {riskStateDonutData.length > 0 && (
                <div style={{ width: 130, height: 110, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskStateDonutData}
                        innerRadius={28}
                        outerRadius={45}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {riskStateDonutData.map((entry, index) => (
                          <Cell key={`donut-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <CustomChartTooltip
                            valueFormatter={(val) => `${val} ${t('global.triage')}`}
                            contextLabel={t('global.status')}
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
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      {formatNumber(risks.data?.length ?? 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Top 3 Prioritized Risks */}
            <div className="card-body" style={{ padding: '12px 20px 16px' }}>
              {risks.loading ? (
                <div className="state-box">{t('dashboard.riskLandscape.loadingRisks')}</div>
              ) : activeRisksList.length === 0 ? (
                <div className="empty-state">{t('dashboard.riskLandscape.emptyRisks')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeRisksList.slice(0, 3).map((r) => (
                    <div
                      key={r.risk_fingerprint || r.id}
                      onClick={() => setSelectedRisk(r)}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)'
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--cyan)' }}>
                            #{String(r.priority_rank ?? 1).padStart(2, '0')}
                          </span>
                          <span className={`severity ${r.severity?.toLowerCase()}`}>
                            {r.severity}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                            {r.product_name || r.sku}
                          </span>
                        </div>
                        <StatePill state={r.current_state} />
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {r.impact_summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-footer">
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('dashboard.riskLandscape.clickToDrawer')}
              </span>
              <button
                type="button"
                onClick={() => navigate('/risk-queue')}
                style={{ fontSize: 11.5, color: 'var(--brand-light)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span>{t('dashboard.riskLandscape.viewFullQueue')}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* FINANCIAL EXPOSURE MODULE */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={15} color="var(--brand)" />
                  <h3>{t('dashboard.financialExposure.title')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('dashboard.financialExposure.subtitle')}
                </div>
              </div>
              <Link to="/financial" className="action-link" style={{ fontSize: 12, color: 'var(--brand-light)' }}>
                <span>{t('dashboard.financialExposure.analysisLink')}</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            {financial.loading ? (
              <div className="state-box" style={{ margin: 20 }}>{t('dashboard.financialExposure.evaluating')}</div>
            ) : financial.error ? (
              <div className="state-box error" style={{ margin: 20 }}>
                <span>{financial.error}</span>
                <button type="button" className="btn-retry" onClick={loadFinancial}>{t('global.retry')}</button>
              </div>
            ) : financial.data ? (
              <>
                <div className="fin-metrics-grid">
                  <div className="fin-metric-tile highlight">
                    <span className="fin-metric-label">{t('dashboard.financialExposure.dailyExposure')}</span>
                    <span className="fin-metric-val risk">
                      {financial.data.total_daily_revenue_exposure != null
                        ? `${formatCurrency(financial.data.total_daily_revenue_exposure)}${t('global.perDay')}`
                        : '—'}
                    </span>
                    <span className="fin-metric-caption">
                      {t('dashboard.financialExposure.skusAtRisk', { count: formatNumber(financial.data.financially_exposed_sku_count ?? 0) })}
                    </span>
                  </div>

                  <div className="fin-metric-tile caution">
                    <span className="fin-metric-label">{t('dashboard.financialExposure.trappedCapital')}</span>
                    <span className="fin-metric-val ack">
                      {formatCurrency(financial.data.total_trapped_retail_inventory_value)}
                    </span>
                    <span className="fin-metric-caption">
                      {t('dashboard.financialExposure.stagnantSkus', { count: formatNumber(financial.data.stagnant_sku_count ?? 0) })}
                    </span>
                  </div>

                  <div className="fin-metric-tile neutral">
                    <span className="fin-metric-label">{t('dashboard.financialExposure.projected7d')}</span>
                    <span className="fin-metric-val risk">
                      {formatCurrency(financial.data.projected_7d_revenue_exposure)}
                    </span>
                    <span className="fin-metric-caption">
                      {t('dashboard.financialExposure.projected30dCaption', { amount: formatCurrency(financial.data.projected_30d_revenue_exposure) })}
                    </span>
                  </div>

                  <div className="fin-metric-tile neutral">
                    <span className="fin-metric-label">{t('dashboard.financialExposure.onHandValuation')}</span>
                    <span className="fin-metric-val">
                      {formatCurrency(financial.data.total_retail_inventory_value_on_hand)}
                    </span>
                    <span className="fin-metric-caption">
                      {t('dashboard.financialExposure.evaluatedSkus', { count: formatNumber(financial.data.total_active_sku_count ?? 0) })}
                    </span>
                  </div>
                </div>

                {/* Projection comparison mini-bar visualization */}
                {financialExposureChartData.length > 0 && (
                  <div style={{ height: 130, padding: '0 20px 10px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialExposureChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'IBM Plex Mono' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `₹${v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                        />
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => formatCurrency(val)}
                              contextLabel={t('dashboard.financialExposure.projectionContext')}
                            />
                          }
                        />
                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                          {financialExposureChartData.map((entry, index) => (
                            <Cell key={`bar-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {financial.data.projection_disclaimer && (
                  <div style={{ padding: '0 20px 10px', fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Note: {financial.data.projection_disclaimer}
                  </div>
                )}

                <div className="card-footer">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t('dashboard.financialExposure.costBasisNote')}
                  </span>
                  <Link to="/financial" style={{ fontSize: 11.5, color: 'var(--brand-light)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span>{t('dashboard.financialExposure.deepBreakdown')}</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </>
            ) : (
              <div className="state-box degraded" style={{ margin: 20 }}>{t('dashboard.financialExposure.unavailable')}</div>
            )}
          </div>

        </div>

        {/* ── 4. NEXUS INTELLIGENCE PIPELINE TOPOLOGY ─────────────────── */}
        <IntelligencePipeline />

        {/* ── 5. SPLIT SECTION: AUDIT STREAM & INVENTORY HEALTH DONUT ─── */}
        <div className="cmd-grid-split">

          {/* AUDIT STREAM */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Activity size={15} color="var(--resolved)" />
                  <h3>{t('dashboard.auditStream.title')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('dashboard.auditStream.subtitle')}
                </div>
              </div>
              <Link to="/activity" className="action-link" style={{ fontSize: 12, color: 'var(--brand-light)' }}>
                <span>{t('dashboard.auditStream.streamLink')}</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="card-body" style={{ padding: '12px 20px' }}>
              {activity.loading ? (
                <div className="state-box">{t('dashboard.auditStream.loading')}</div>
              ) : activity.data.length === 0 ? (
                <div className="empty-state">{t('dashboard.auditStream.empty')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activity.data.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        paddingBottom: 10,
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StatePill state={act.state} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>
                            {act.risk_category ? act.risk_category.replaceAll('_', ' ') : t('dashboard.auditStream.systemVerified')}
                          </span>
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {act.action_note ? `“${act.action_note}”` : (act.user_email ? t('dashboard.auditStream.recordedBy', { actor: act.user_email }) : t('dashboard.auditStream.systemVerified'))}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(act.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* INVENTORY HEALTH WITH DONUT & SAFETY BUFFER GAUGES */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={15} color="var(--cyan)" />
                  <h3>{t('dashboard.inventoryHealth.title')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('dashboard.inventoryHealth.subtitle')}
                </div>
              </div>
              <Link to="/inventory" className="action-link" style={{ fontSize: 12, color: 'var(--brand-light)' }}>
                <span>{t('dashboard.inventoryHealth.inventoryLink')}</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="card-body">
              {/* Inventory Health Donut Visualizer */}
              {inventoryHealthDonutData.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 120, height: 110, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryHealthDonutData}
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {inventoryHealthDonutData.map((entry, index) => (
                            <Cell key={`inv-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => `${val} ${t('global.sku')}`}
                              contextLabel={t('dashboard.inventoryHealth.title')}
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
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                        {formatNumber(kpis.data?.active_products_count ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
                    {inventoryHealthDonutData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <span className="mono" style={{ fontWeight: 600, color: item.color }}>
                          {formatNumber(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dashboard.inventoryHealth.totalEvaluatedSkus')}</span>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {kpis.data?.active_products_count != null ? formatNumber(kpis.data.active_products_count) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245,166,35,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,166,35,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ack)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('dashboard.inventoryHealth.lowStockProducts')}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ack-light)' }}>
                    {kpis.data?.low_stock_products_count != null ? formatNumber(kpis.data.low_stock_products_count) : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,77,94,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,77,94,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t('dashboard.inventoryHealth.outOfStockProducts')}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--risk-light)' }}>
                    {kpis.data?.out_of_stock_products_count != null ? formatNumber(kpis.data.out_of_stock_products_count) : '—'}
                  </span>
                </div>

                <div style={{ marginTop: 4, display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-command-action secondary"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => navigate('/inventory')}
                  >
                    {t('dashboard.inventoryHealth.catalogStockBtn')}
                  </button>
                  <button
                    type="button"
                    className="btn-command-action secondary"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => navigate('/transactions')}
                  >
                    {t('dashboard.inventoryHealth.transactionsBtn')}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Contextual Risk Intelligence Drawer */}
      <RiskIntelligenceDrawer
        risk={selectedRisk}
        onClose={() => setSelectedRisk(null)}
        onActionSuccess={(updatedRisk) => {
          setRisks((prev) => ({
            ...prev,
            data: prev.data.map((r) =>
              (r.risk_fingerprint === updatedRisk.risk_fingerprint || r.id === updatedRisk.id)
                ? updatedRisk
                : r
            ),
          }))
          loadActivity()
        }}
      />
    </>
  )
}
