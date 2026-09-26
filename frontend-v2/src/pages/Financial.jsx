import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  TrendingUp,
  RotateCw,
  AlertTriangle,
  Coins,
  Layers,
  ShieldCheck,
  ArrowRight,
  Filter,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
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
  InsightCallout,
  DataTable,
} from '../components/primitives/index.js'
import { fetchBusinessFinancialSummary } from '../api.js'
import { useI18n } from '../i18n/index.jsx'
import { useNavigate } from 'react-router-dom'

export default function Financial({ onToggleMobileMenu }) {
  const { t, formatCurrency, formatNumber } = useI18n()
  const navigate = useNavigate()

  const [data, setData] = useState({ loading: true, error: null, summary: null })
  const [selectedSkuRisk, setSelectedSkuRisk] = useState(null)
  const [sortField, setSortField] = useState('daily_exposure')
  const [searchQuery, setSearchQuery] = useState('')

  const loadFinancial = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const summary = await fetchBusinessFinancialSummary(30)
      setData({ loading: false, error: null, summary })
    } catch (err) {
      setData({
        loading: false,
        error: err.message || t('global.error'),
        summary: null,
      })
    }
  }, [t])

  useEffect(() => {
    loadFinancial()
  }, [loadFinancial])

  const s = data.summary

  // 1. Exposure Projections (1d, 7d, 30d)
  const projectionChartData = useMemo(() => {
    if (!s) return []
    return [
      {
        name: t('financial.sortDailyExposure'),
        amount: s.total_daily_revenue_exposure || 0,
        color: '#f43f5e',
      },
      {
        name: t('dashboard.financialExposure.projected7d'),
        amount: s.projected_7d_revenue_exposure || 0,
        color: '#f59e0b',
      },
      {
        name: '30-DAY PROJECTION',
        amount: s.projected_30d_revenue_exposure || 0,
        color: '#3b82f6',
      },
    ]
  }, [s, t])

  // 2. Capital Composition Donut: On-Hand vs Trapped Capital
  const capitalCompositionData = useMemo(() => {
    if (!s) return []
    const totalOnHand = s.total_retail_inventory_value_on_hand || 0
    const trapped = s.total_trapped_retail_inventory_value || 0
    const activeCapital = Math.max(0, totalOnHand - trapped)

    return [
      {
        name: t('financial.activeCapital'),
        value: activeCapital,
        color: '#10b981',
      },
      {
        name: t('financial.trappedCapitalLabel'),
        value: trapped,
        color: '#f59e0b',
      },
    ].filter((item) => item.value > 0)
  }, [s, t])

  // 3. Impacted SKUs Horizontal Bar Chart data
  const horizontalBarData = useMemo(() => {
    if (!s?.impacted_skus) return []
    return [...s.impacted_skus]
      .sort((a, b) => (b.daily_revenue_exposure || 0) - (a.daily_revenue_exposure || 0))
      .slice(0, 6)
      .map((sku) => ({
        name: sku.sku || `P${sku.product_id}`,
        fullName: sku.product_name || sku.sku,
        exposure: Number(sku.daily_revenue_exposure || 0),
        trapped: Number(sku.trapped_retail_inventory_value || 0),
        severity: sku.risk_severity || 'HIGH',
      }))
  }, [s?.impacted_skus])

  // 4. Filtered & Sorted SKUs for table
  const filteredSortedSkus = useMemo(() => {
    if (!s?.impacted_skus) return []
    let list = [...s.impacted_skus]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((item) => {
        const name = (item.product_name || '').toLowerCase()
        const sku = (item.sku || '').toLowerCase()
        return name.includes(q) || sku.includes(q)
      })
    }

    if (sortField === 'daily_exposure') {
      list.sort((a, b) => (b.daily_revenue_exposure || 0) - (a.daily_revenue_exposure || 0))
    } else if (sortField === 'trapped_capital') {
      list.sort((a, b) => (b.trapped_retail_inventory_value || 0) - (a.trapped_retail_inventory_value || 0))
    } else if (sortField === 'on_hand') {
      list.sort((a, b) => (b.retail_value_on_hand || 0) - (a.retail_value_on_hand || 0))
    }
    return list
  }, [s?.impacted_skus, sortField, searchQuery])

  // Table columns definition
  const tableColumns = [
    {
      key: 'sku',
      header: 'SKU & IDENTIFIER',
      mono: true,
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>{row.sku || `P${row.product_id}`}</span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.product_name}</div>
        </div>
      ),
    },
    {
      key: 'risk_severity',
      header: 'SEVERITY',
      render: (sev) => <span className={`severity ${sev?.toLowerCase()}`}>{sev || 'HIGH'}</span>,
    },
    {
      key: 'daily_revenue_exposure',
      header: 'DAILY EXPOSURE',
      align: 'right',
      mono: true,
      render: (val) => (
        <span style={{ color: 'var(--risk-light)', fontWeight: 600 }}>
          {val != null ? formatCurrency(val) : '—'}
        </span>
      ),
    },
    {
      key: 'trapped_retail_inventory_value',
      header: 'TRAPPED CAPITAL',
      align: 'right',
      mono: true,
      render: (val) => (
        <span style={{ color: 'var(--ack-light)', fontWeight: 600 }}>
          {val != null ? formatCurrency(val) : '—'}
        </span>
      ),
    },
    {
      key: 'retail_value_on_hand',
      header: 'RETAIL VALUE ON HAND',
      align: 'right',
      mono: true,
      render: (val) => (val != null ? formatCurrency(val) : '—'),
    },
    {
      key: 'actions',
      header: 'INVESTIGATE',
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/investigations?q=Explain financial exposure for ${row.product_name || row.sku}`)
          }}
          style={{
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--cyan)',
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Ask AI</span>
          <ArrowRight size={11} />
        </button>
      ),
    },
  ]

  return (
    <ErrorBoundary>
      <Topbar
        title={t('financial.title').toUpperCase()}
        subtitle={t('financial.desc')}
        onRefresh={loadFinancial}
        isRefreshing={data.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta={t('financial.meta')}
          title={t('financial.title')}
          description={t('financial.desc')}
          badge={<VerifiedBadge />}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionButton
                variant="subtle"
                size="sm"
                icon={RotateCw}
                onClick={loadFinancial}
                loading={data.loading}
              >
                Sync Terminal
              </ActionButton>
            </div>
          }
        />

        {/* ── Financial Terminal KPI Tiles ────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Metric
            label={t('dashboard.financialExposure.dailyExposure')}
            value={s?.total_daily_revenue_exposure != null ? `${formatCurrency(s.total_daily_revenue_exposure)}/day` : '—'}
            verified
            icon={AlertTriangle}
            statusDot="#f43f5e"
            changeDirection="negative"
            changeLabel={`${formatNumber(s?.financially_exposed_sku_count ?? 0)} exposed SKUs`}
          />
          <Metric
            label={t('dashboard.financialExposure.trappedCapital')}
            value={s?.total_trapped_retail_inventory_value != null ? formatCurrency(s.total_trapped_retail_inventory_value) : '—'}
            verified
            icon={Coins}
            statusDot="#f59e0b"
            changeDirection="neutral"
            changeLabel={`${formatNumber(s?.stagnant_sku_count ?? 0)} stagnant SKUs`}
          />
          <Metric
            label={t('dashboard.financialExposure.projected7d')}
            value={s?.projected_7d_revenue_exposure != null ? formatCurrency(s.projected_7d_revenue_exposure) : '—'}
            verified
            icon={TrendingUp}
            changeLabel={`30D: ${s?.projected_30d_revenue_exposure ? formatCurrency(s.projected_30d_revenue_exposure) : '—'}`}
          />
          <Metric
            label={t('dashboard.financialExposure.onHandValuation')}
            value={s?.total_retail_inventory_value_on_hand != null ? formatCurrency(s.total_retail_inventory_value_on_hand) : '—'}
            verified
            icon={Layers}
            changeLabel={`${formatNumber(s?.total_active_sku_count ?? 0)} active SKUs evaluated`}
          />
        </div>

        {/* ── Visual Intelligence Runway: Projections & Capital Breakdown ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 16,
            marginBottom: 20,
          }}
          className="cmd-grid-financial"
        >
          {/* Exposure Horizon Bar Chart */}
          <DataPanel
            title="EXPOSURE PROJECTION RUNWAY"
            subtitle="Deterministic stockout loss projections over 1d, 7d, and 30d horizons"
            icon={TrendingUp}
            badge={<VerifiedBadge />}
          >
            <div style={{ height: 200, padding: '10px 10px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectionChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                        contextLabel="Projected stockout revenue risk"
                      />
                    }
                  />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {projectionChartData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {s?.projection_disclaimer && (
              <div style={{ padding: '8px 16px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Note: {s.projection_disclaimer}
              </div>
            )}
          </DataPanel>

          {/* Capital Composition Donut */}
          <DataPanel
            title="CAPITAL COMPOSITION"
            subtitle="Active working stock vs trapped capital"
            icon={Coins}
            badge={<VerifiedBadge />}
          >
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {capitalCompositionData.length > 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 140, height: 130, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={capitalCompositionData}
                          innerRadius={32}
                          outerRadius={52}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {capitalCompositionData.map((entry, index) => (
                            <Cell key={`cap-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip valueFormatter={(v) => formatCurrency(v)} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                    {capitalCompositionData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span className="mono" style={{ fontWeight: 700, color: d.color, marginLeft: 13 }}>
                          {formatCurrency(d.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Evaluating capital...</span>
              )}
            </div>
          </DataPanel>
        </div>

        {/* ── Impacted SKUs Table Command Surface ─────────────────────── */}
        <CommandSurface
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Filter impacted SKUs by name or code..."
          filters={[
            { id: 'daily', label: 'SORT: DAILY EXPOSURE', active: sortField === 'daily_exposure', onClick: () => setSortField('daily_exposure') },
            { id: 'trapped', label: 'SORT: TRAPPED CAPITAL', active: sortField === 'trapped_capital', onClick: () => setSortField('trapped_capital') },
            { id: 'on_hand', label: 'SORT: TOTAL ON-HAND', active: sortField === 'on_hand', onClick: () => setSortField('on_hand') },
          ]}
          metadata={`${filteredSortedSkus.length} EXPOSED SKUS`}
        />

        <DataTable
          columns={tableColumns}
          data={filteredSortedSkus}
          rowKey={(r) => r.sku || r.product_id}
          loading={data.loading}
          emptyTitle="No Financially Exposed SKUs"
          emptyDescription="Zero SKUs currently have detected stockout revenue exposure or stagnant capital."
        />

        {/* Informational Callout */}
        <div style={{ marginTop: 20 }}>
          <InsightCallout type="verified" title="Deterministic Financial Valuation Authority">
            All exposure sums and asset values are calculated via SQLite row-level aggregation using exact Decimal arithmetic.
            Stockout exposure estimates reflect projected lost revenue based on moving average sales velocity.
          </InsightCallout>
        </div>

        {/* Sku Risk Drawer */}
        {selectedSkuRisk && (
          <RiskIntelligenceDrawer
            risk={selectedSkuRisk}
            onClose={() => setSelectedSkuRisk(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
