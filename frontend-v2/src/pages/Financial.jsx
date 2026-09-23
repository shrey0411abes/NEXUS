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
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import RiskIntelligenceDrawer from '../components/RiskIntelligenceDrawer.jsx'
import { fetchBusinessFinancialSummary } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

export default function Financial({ onToggleMobileMenu }) {
  const { t, formatCurrency } = useI18n()

  const [data, setData] = useState({ loading: true, error: null, summary: null })
  const [selectedSkuRisk, setSelectedSkuRisk] = useState(null)
  const [sortField, setSortField] = useState('daily_exposure')

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
        color: '#ff4d5e',
      },
      {
        name: t('dashboard.financialExposure.projected7d'),
        amount: s.projected_7d_revenue_exposure || 0,
        color: '#f5a623',
      },
      {
        name: '30D',
        amount: s.projected_30d_revenue_exposure || 0,
        color: '#4f75ff',
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
        color: '#00e676',
      },
      {
        name: t('financial.trappedCapitalLabel'),
        value: trapped,
        color: '#f5a623',
      },
    ].filter((item) => item.value > 0)
  }, [s, t])

  // 3. Impacted SKUs Horizontal Bar Chart data
  const horizontalBarData = useMemo(() => {
    if (!s?.impacted_skus) return []
    return [...s.impacted_skus]
      .sort((a, b) => (b.daily_revenue_exposure || 0) - (a.daily_revenue_exposure || 0))
      .slice(0, 7)
      .map((sku) => ({
        name: sku.sku || `P${sku.product_id}`,
        fullName: sku.product_name || sku.sku,
        exposure: Number(sku.daily_revenue_exposure || 0),
        trapped: Number(sku.trapped_retail_inventory_value || 0),
        severity: sku.risk_severity || 'HIGH',
      }))
  }, [s?.impacted_skus])

  // 4. Sorted SKUs for table
  const sortedSkus = useMemo(() => {
    if (!s?.impacted_skus) return []
    const list = [...s.impacted_skus]
    if (sortField === 'daily_exposure') {
      list.sort((a, b) => (b.daily_revenue_exposure || 0) - (a.daily_revenue_exposure || 0))
    } else if (sortField === 'trapped_capital') {
      list.sort((a, b) => (b.trapped_retail_inventory_value || 0) - (a.trapped_retail_inventory_value || 0))
    } else if (sortField === 'on_hand') {
      list.sort((a, b) => (b.retail_value_on_hand || 0) - (a.retail_value_on_hand || 0))
    }
    return list
  }, [s?.impacted_skus, sortField])

  return (
    <>
      <Topbar
        title={t('financial.title').toUpperCase()}
        subtitle={t('financial.desc')}
        onRefresh={loadFinancial}
        isRefreshing={data.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--brand-light)', fontWeight: 600 }}>
                {t('financial.meta')}
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                {t('global.verified')}
              </span>
              {s?.observation_days && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {s.observation_days}D OBSERVATION WINDOW
                </span>
              )}
            </div>
            <h1 className="command-header-title">{t('financial.title')}</h1>
            <p className="command-header-desc">{t('financial.desc')}</p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadFinancial}
              disabled={data.loading}
            >
              <RotateCw size={13} className={data.loading ? 'spin-anim' : ''} />
              <span>{t('financial.refreshTelemetry')}</span>
            </button>
          </div>
        </div>

        {data.loading ? (
          <div className="state-box" style={{ padding: 48 }}>
            {t('global.loading')}
          </div>
        ) : data.error ? (
          <div className="state-box error" style={{ padding: 32 }}>
            <span>{data.error}</span>
            <button type="button" className="btn-retry" onClick={loadFinancial}>
              {t('global.retry')}
            </button>
          </div>
        ) : s ? (
          <>
            {/* ── 1. CAPITAL AT RISK KPI CARDS ─────────────────────────── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div className="card" style={{ padding: 22, borderLeft: '4px solid var(--risk)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--risk-light)' }}>
                  {t('financial.dailyExposure')}
                </span>
                <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--risk-light)', margin: '6px 0 2px' }}>
                  {formatCurrency(s.total_daily_revenue_exposure)}{t('global.perDay')}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('financial.skusExceeding', { count: s.financially_exposed_sku_count ?? 0 })}
                </span>
              </div>

              <div className="card" style={{ padding: 22, borderLeft: '4px solid var(--ack)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ack-light)' }}>
                  {t('financial.trappedCapital')}
                </span>
                <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: 'var(--ack-light)', margin: '6px 0 2px' }}>
                  {formatCurrency(s.total_trapped_retail_inventory_value)}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('financial.stagnantSkusCount', { count: s.stagnant_sku_count ?? 0 })}
                </span>
              </div>

              <div className="card" style={{ padding: 22, borderLeft: '4px solid var(--brand)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--brand-light)' }}>
                  {t('financial.onHandValuation')}
                </span>
                <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: '6px 0 2px' }}>
                  {formatCurrency(s.total_retail_inventory_value_on_hand)}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('financial.evaluatedSkusCount', { count: s.total_active_sku_count ?? 0 })}
                </span>
              </div>
            </div>

            {/* ── 2. VISUAL CHARTS GRID: PROJECTIONS + CAPITAL DONUT ───── */}
            <div className="cmd-grid-2col" style={{ marginBottom: 24 }}>

              {/* Exposure Projections Chart */}
              <div className="card">
                <div className="card-head">
                  <div className="card-title-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={15} color="var(--risk)" />
                      <h3>{t('financial.projectionsTitle')}</h3>
                    </div>
                    <div className="card-subtitle">
                      {t('financial.projectionsSubtitle')}
                    </div>
                  </div>
                </div>

                <div className="card-body" style={{ height: 220, padding: '16px 20px 4px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectionChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                      />
                      <Tooltip
                        content={
                          <CustomChartTooltip
                            valueFormatter={(val) => formatCurrency(val)}
                            contextLabel={t('dashboard.financialExposure.projectionContext')}
                          />
                        }
                      />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {projectionChartData.map((entry, index) => (
                          <Cell key={`proj-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {s.projection_disclaimer && (
                  <div style={{ padding: '0 20px 14px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {s.projection_disclaimer}
                  </div>
                )}
              </div>

              {/* Capital Composition Donut */}
              <div className="card">
                <div className="card-head">
                  <div className="card-title-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Coins size={15} color="var(--brand)" />
                      <h3>{t('financial.capitalCompositionTitle')}</h3>
                    </div>
                    <div className="card-subtitle">
                      {t('financial.capitalCompositionSubtitle')}
                    </div>
                  </div>
                </div>

                <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 220, padding: 12 }}>
                  <div style={{ width: 170, height: 170, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={capitalCompositionData}
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {capitalCompositionData.map((entry, index) => (
                            <Cell key={`cap-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => formatCurrency(val)}
                              contextLabel={t('financial.capitalCompositionTitle')}
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
                        {formatCurrency(s.total_retail_inventory_value_on_hand)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e676' }} />
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>{t('financial.activeCapital')}</div>
                        <div className="mono" style={{ fontWeight: 600, color: '#00e676' }}>
                          {formatCurrency((s.total_retail_inventory_value_on_hand || 0) - (s.total_trapped_retail_inventory_value || 0))}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5a623' }} />
                      <div>
                        <div style={{ color: 'var(--text-secondary)' }}>{t('financial.trappedCapitalLabel')}</div>
                        <div className="mono" style={{ fontWeight: 600, color: '#f5a623' }}>
                          {formatCurrency(s.total_trapped_retail_inventory_value)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {s.cost_basis_disclaimer && (
                  <div style={{ padding: '0 20px 14px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {s.cost_basis_disclaimer}
                  </div>
                )}
              </div>

            </div>

            {/* ── 3. HORIZONTAL BAR CHART: FINANCIAL IMPACT RANKING ───── */}
            {horizontalBarData.length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-head">
                  <div className="card-title-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TrendingUp size={15} color="var(--risk)" />
                      <h3>{t('financial.topImpactedTitle')}</h3>
                    </div>
                    <div className="card-subtitle">
                      {t('financial.topImpactedSubtitle')}
                    </div>
                  </div>
                </div>

                <div className="card-body" style={{ height: 240, padding: '16px 20px 4px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={horizontalBarData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
                        tickFormatter={(v) => `₹${v}`}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={
                          <CustomChartTooltip
                            valueFormatter={(val) => formatCurrency(val)}
                            contextLabel={t('financial.sortDailyExposure')}
                          />
                        }
                      />
                      <Bar dataKey="exposure" name={t('financial.sortDailyExposure')} fill="#ff4d5e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── 4. FINANCIALLY IMPACTED SKUS TABLE ──────────────────── */}
            {sortedSkus.length > 0 && (
              <div className="card" style={{ marginBottom: 28 }}>
                <div className="card-head">
                  <div className="card-title-group">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Layers size={15} color="var(--brand)" />
                      <h3>{t('financial.impactedTableTitle', { count: sortedSkus.length })}</h3>
                    </div>
                    <div className="card-subtitle">
                      {t('financial.impactedTableSubtitle')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t('financial.sortBy')}</span>
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    >
                      <option value="daily_exposure">{t('financial.sortDailyExposure')}</option>
                      <option value="trapped_capital">{t('financial.sortTrappedCapital')}</option>
                      <option value="on_hand">{t('financial.sortOnHand')}</option>
                    </select>
                  </div>
                </div>

                <div className="table-scroll-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 220 }}>{t('financial.productSkuHeader')}</th>
                        <th style={{ width: 100 }}>{t('financial.severityHeader')}</th>
                        <th style={{ width: 150, textAlign: 'right' }}>{t('financial.dailyRunRateHeader')}</th>
                        <th style={{ width: 160, textAlign: 'right' }}>{t('financial.onHandHeader')}</th>
                        <th style={{ width: 150, textAlign: 'right' }}>{t('financial.trappedCapitalHeader')}</th>
                        <th>{t('financial.actionHeader')}</th>
                        <th style={{ width: 90, textAlign: 'right' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSkus.map((sku) => (
                        <tr
                          key={sku.product_id}
                          className="clickable"
                          onClick={() => setSelectedSkuRisk({
                            product_id: sku.product_id,
                            product_name: sku.product_name,
                            sku: sku.sku,
                            severity: sku.risk_severity || 'HIGH',
                            risk_category: 'FINANCIAL_EXPOSURE',
                            impact_summary: `Daily exposure: ${formatCurrency(sku.daily_revenue_exposure)}. Trapped capital: ${formatCurrency(sku.trapped_retail_inventory_value)}.`,
                            recommended_action: sku.recommended_action,
                            current_state: 'OPEN',
                          })}
                        >
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>
                              {sku.product_name || t('global.product')}
                            </div>
                            {sku.sku && (
                              <div className="cell-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {sku.sku}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`severity ${sku.risk_severity ? sku.risk_severity.toLowerCase() : 'low'}`}>
                              {sku.risk_severity || '—'}
                            </span>
                          </td>
                          <td className="cell-mono" style={{ textAlign: 'right', fontWeight: 600, color: sku.daily_revenue_exposure > 0 ? 'var(--risk-light)' : 'inherit' }}>
                            {formatCurrency(sku.daily_revenue_exposure)}{t('global.perDay')}
                          </td>
                          <td className="cell-mono" style={{ textAlign: 'right' }}>
                            {formatCurrency(sku.retail_value_on_hand)}
                          </td>
                          <td className="cell-mono" style={{ textAlign: 'right', color: sku.trapped_retail_inventory_value > 0 ? 'var(--ack-light)' : 'inherit' }}>
                            {formatCurrency(sku.trapped_retail_inventory_value)}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {sku.recommended_action || '—'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-command-action secondary"
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              {t('global.triage')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="state-box degraded">{t('dashboard.financialExposure.unavailable')}</div>
        )}

      </div>

      {/* Drawer */}
      <RiskIntelligenceDrawer
        risk={selectedSkuRisk}
        onClose={() => setSelectedSkuRisk(null)}
      />
    </>
  )
}
