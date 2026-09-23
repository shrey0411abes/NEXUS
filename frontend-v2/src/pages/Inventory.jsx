import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
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
  Legend,
} from 'recharts'
import {
  Package,
  RotateCw,
  Search,
  Layers,
  ArrowRight,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import { fetchInventory } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

function computeStockState(quantity, reorderLevel) {
  if (quantity == null) return { key: 'UNKNOWN', color: 'var(--text-muted)', class: 'dismissed' }
  if (quantity === 0) return { key: 'OUT_OF_STOCK', color: 'var(--risk)', class: 'open' }
  if (reorderLevel != null) {
    if (quantity <= Math.max(1, Math.floor(reorderLevel * 0.5))) {
      return { key: 'CRITICAL', color: '#ff8a65', class: 'open' }
    }
    if (quantity <= reorderLevel) {
      return { key: 'LOW', color: 'var(--ack)', class: 'acknowledged' }
    }
    if (quantity <= Math.floor(reorderLevel * 1.5)) {
      return { key: 'WATCH', color: 'var(--cyan)', class: 'acknowledged' }
    }
  }
  return { key: 'HEALTHY', color: 'var(--resolved)', class: 'resolved' }
}

function getStockStateLabel(key, t) {
  switch (key) {
    case 'OUT_OF_STOCK':
      return t('inventory.statusOutOfStock')
    case 'CRITICAL':
      return t('inventory.statusCritical')
    case 'LOW':
      return t('inventory.statusLow')
    case 'WATCH':
      return t('inventory.statusWatch')
    case 'HEALTHY':
      return t('inventory.statusHealthy')
    default:
      return t('inventory.statusUnknown')
  }
}

export default function Inventory({ onToggleMobileMenu }) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const [inventory, setInventory] = useState({ loading: true, error: null, data: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('ALL')

  const loadInventory = useCallback(async () => {
    setInventory((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchInventory(200, 0)
      setInventory({ loading: false, error: null, data: Array.isArray(data) ? data : [] })
    } catch (err) {
      setInventory({
        loading: false,
        error: err.message || t('global.error'),
        data: [],
      })
    }
  }, [t])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // Summaries
  const stockSummary = useMemo(() => {
    const list = inventory.data || []
    let outCount = 0
    let critCount = 0
    let lowCount = 0
    let watchCount = 0
    let healthyCount = 0

    list.forEach((item) => {
      const state = computeStockState(item.quantity, item.reorder_level)
      if (state.key === 'OUT_OF_STOCK') outCount++
      else if (state.key === 'CRITICAL') critCount++
      else if (state.key === 'LOW') lowCount++
      else if (state.key === 'WATCH') watchCount++
      else healthyCount++
    })

    return {
      total: list.length,
      outCount,
      critCount,
      lowCount,
      watchCount,
      healthyCount,
      atRiskCount: outCount + critCount + lowCount,
    }
  }, [inventory.data])

  // Donut chart distribution
  const inventoryDonutData = useMemo(() => {
    const list = inventory.data || []
    if (list.length === 0) return []
    let outCount = 0
    let critCount = 0
    let lowCount = 0
    let watchCount = 0
    let healthyCount = 0

    list.forEach((item) => {
      const state = computeStockState(item.quantity, item.reorder_level)
      if (state.key === 'OUT_OF_STOCK') outCount++
      else if (state.key === 'CRITICAL') critCount++
      else if (state.key === 'LOW') lowCount++
      else if (state.key === 'WATCH') watchCount++
      else healthyCount++
    })

    return [
      { name: t('inventory.statusHealthy'), value: healthyCount, color: '#00e676' },
      { name: t('inventory.statusWatch'), value: watchCount, color: '#00d2ff' },
      { name: t('inventory.statusLow'), value: lowCount, color: '#f5a623' },
      { name: t('inventory.statusCritical'), value: critCount, color: '#ff8a65' },
      { name: t('inventory.statusOutOfStock'), value: outCount, color: '#ff4d5e' },
    ].filter((d) => d.value > 0)
  }, [inventory.data, t])

  // Chart data: Top items comparing quantity to reorder level
  const chartData = useMemo(() => {
    if (!inventory.data || inventory.data.length === 0) return []
    return inventory.data.slice(0, 12).map((item) => ({
      name: `P${item.product_id}`,
      productId: item.product_id,
      quantity: item.quantity ?? 0,
      reorderLevel: item.reorder_level ?? 0,
    }))
  }, [inventory.data])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return inventory.data.filter((item) => {
      const state = computeStockState(item.quantity, item.reorder_level)
      if (stateFilter !== 'ALL' && state.key !== stateFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const pStr = `p${item.product_id}`.toLowerCase()
        const idStr = String(item.id)
        return pStr.includes(q) || idStr.includes(q)
      }
      return true
    })
  }, [inventory.data, stateFilter, searchQuery])

  return (
    <>
      <Topbar
        title={t('inventory.title').toUpperCase()}
        subtitle={t('inventory.desc')}
        onRefresh={loadInventory}
        isRefreshing={inventory.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="command-header">
          <div className="command-header-left">
            <div className="command-header-meta">
              <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>
                {t('inventory.meta')}
              </span>
              <span className="command-status-badge">
                <span className="status-dot-pulse" />
                {t('inventory.sqliteReconciled')}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {t('inventory.recordsBadge', { count: formatNumber(inventory.data.length) })}
              </span>
            </div>
            <h1 className="command-header-title">{t('inventory.title')}</h1>
            <p className="command-header-desc">
              {t('inventory.desc')}
            </p>
          </div>

          <div className="command-header-actions">
            <button
              type="button"
              className="btn-command-action secondary"
              onClick={loadInventory}
              disabled={inventory.loading}
            >
              <RotateCw size={13} className={inventory.loading ? 'spin-anim' : ''} />
              <span>{t('inventory.refreshStock')}</span>
            </button>
          </div>
        </div>

        {/* ── Operational Metric Indicators ──────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ padding: 18 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {t('inventory.totalTracked')}
            </span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '4px 0 2px' }}>
              {formatNumber(stockSummary.total)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {t('inventory.catalogRecords')}
            </span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(255, 77, 94, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--risk-light)' }}>
              {t('inventory.outOfStockLabel')}
            </span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--risk-light)', margin: '4px 0 2px' }}>
              {formatNumber(stockSummary.outCount)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {t('inventory.depletedZero')}
            </span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(245, 166, 35, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--ack-light)' }}>
              {t('inventory.criticalLow')}
            </span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ack-light)', margin: '4px 0 2px' }}>
              {formatNumber(stockSummary.critCount + stockSummary.lowCount)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {t('inventory.atOrBelowReorder')}
            </span>
          </div>

          <div className="card" style={{ padding: 18, borderColor: 'rgba(0, 230, 118, 0.25)' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--resolved-light)' }}>
              {t('inventory.healthySafetyStock')}
            </span>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--resolved-light)', margin: '4px 0 2px' }}>
              {formatNumber(stockSummary.healthyCount)}
            </div>
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
              {t('inventory.aboveBuffer')}
            </span>
          </div>
        </div>

        {/* ── Visual Analytics Section: State Donut + Threshold Comparison ──── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: 20, marginBottom: 24 }}>

          {/* A. Inventory State Distribution Donut */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={15} color="var(--cyan)" />
                  <h3>{t('inventory.stateDistributionTitle')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('inventory.stateDistributionSubtitle')}
                </div>
              </div>
            </div>

            <div className="card-body" style={{ padding: '16px 20px' }}>
              {inventory.loading ? (
                <div className="state-box" style={{ height: 180 }}>{t('inventory.loadingStates')}</div>
              ) : inventoryDonutData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ width: '100%', height: 170, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryDonutData}
                          innerRadius={46}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {inventoryDonutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={
                            <CustomChartTooltip
                              valueFormatter={(val) => `${formatNumber(val)} ${t('inventory.skusUnit')}`}
                              contextLabel={t('inventory.stockCategory')}
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
                      <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                        {formatNumber(inventory.data.length)}
                      </span>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {t('inventory.skusUnit')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5 }}>
                    {inventoryDonutData.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="mono" style={{ fontWeight: 600, color: item.color }}>
                            {formatNumber(item.value)}
                          </span>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', width: 34, textAlign: 'right' }}>
                            {Math.round((item.value / (inventory.data.length || 1)) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="state-box">{t('inventory.noDistribution')}</div>
              )}
            </div>
          </div>

          {/* B. Stock Level vs. Reorder Threshold Distribution Bar Chart */}
          <div className="card">
            <div className="card-head">
              <div className="card-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Layers size={15} color="var(--brand)" />
                  <h3>{t('inventory.stockVsReorderTitle')}</h3>
                </div>
                <div className="card-subtitle">
                  {t('inventory.stockVsReorderSubtitle')}
                </div>
              </div>
            </div>

            <div className="card-body" style={{ height: 260, padding: '16px 20px 4px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                    />
                    <Tooltip
                      content={
                        <CustomChartTooltip
                          valueFormatter={(val) => `${formatNumber(val)} ${t('inventory.units')}`}
                          contextLabel={t('inventory.verifiedItem')}
                        />
                      }
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                    />
                    <Bar dataKey="quantity" name={t('inventory.qtyOnHand')} fill="#4f75ff" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="reorderLevel" name={t('inventory.reorderThreshold')} fill="#f5a623" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="state-box" style={{ height: '100%' }}>{t('inventory.noSkuData')}</div>
              )}
            </div>
          </div>

        </div>

        {/* ── Table Filter Controls ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, background: 'rgba(0, 0, 0, 0.25)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setStateFilter('ALL')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: stateFilter === 'ALL' ? 'var(--brand)' : 'transparent',
                color: stateFilter === 'ALL' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {t('inventory.allRecords', { count: formatNumber(inventory.data.length) })}
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('OUT_OF_STOCK')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: stateFilter === 'OUT_OF_STOCK' ? 'rgba(255, 77, 94, 0.2)' : 'transparent',
                color: stateFilter === 'OUT_OF_STOCK' ? 'var(--risk-light)' : 'var(--text-secondary)',
              }}
            >
              {t('inventory.filterOutOfStock', { count: formatNumber(stockSummary.outCount) })}
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('CRITICAL')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: stateFilter === 'CRITICAL' ? 'rgba(255, 138, 101, 0.2)' : 'transparent',
                color: stateFilter === 'CRITICAL' ? '#ff8a65' : 'var(--text-secondary)',
              }}
            >
              {t('inventory.filterCritical', { count: formatNumber(stockSummary.critCount) })}
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('LOW')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: stateFilter === 'LOW' ? 'rgba(245, 166, 35, 0.2)' : 'transparent',
                color: stateFilter === 'LOW' ? 'var(--ack-light)' : 'var(--text-secondary)',
              }}
            >
              {t('inventory.filterLow', { count: formatNumber(stockSummary.lowCount) })}
            </button>
            <button
              type="button"
              onClick={() => setStateFilter('HEALTHY')}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius-xs)',
                fontSize: 12,
                fontWeight: 600,
                background: stateFilter === 'HEALTHY' ? 'rgba(0, 230, 118, 0.2)' : 'transparent',
                color: stateFilter === 'HEALTHY' ? 'var(--resolved-light)' : 'var(--text-secondary)',
              }}
            >
              {t('inventory.filterHealthy', { count: formatNumber(stockSummary.healthyCount) })}
            </button>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={t('inventory.searchPlaceholder')}
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

        {/* ── Inventory Catalog Table ─────────────────────────────────── */}
        <div className="card">
          {inventory.loading ? (
            <div className="state-box">{t('inventory.loadingTelemetry')}</div>
          ) : inventory.error ? (
            <div className="state-box error">
              <span>{inventory.error}</span>
              <button type="button" className="btn-retry" onClick={loadInventory}>{t('global.retry')}</button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state">{t('inventory.emptyFilter')}</div>
          ) : (
            <div className="table-scroll-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>{t('inventory.recordIdHeader')}</th>
                    <th style={{ width: 130 }}>{t('inventory.productIdHeader')}</th>
                    <th style={{ width: 140, textAlign: 'right' }}>{t('inventory.qtyOnHand')}</th>
                    <th style={{ width: 140, textAlign: 'right' }}>{t('inventory.reorderThreshold')}</th>
                    <th style={{ width: 160 }}>{t('inventory.safetyBufferStatusHeader')}</th>
                    <th style={{ width: 180 }}>{t('inventory.safetyGaugeHeader')}</th>
                    <th>{t('inventory.lastSynchronizedHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((item) => {
                    const status = computeStockState(item.quantity, item.reorder_level)
                    const ratio = item.reorder_level ? Math.round((item.quantity / item.reorder_level) * 100) : 100
                    return (
                      <tr key={item.id}>
                        <td className="cell-mono" style={{ color: 'var(--text-muted)' }}>#{item.id}</td>
                        <td className="cell-mono" style={{ color: 'var(--brand-light)', fontWeight: 600 }}>
                          P{item.product_id}
                        </td>
                        <td className="cell-mono" style={{ textAlign: 'right', fontWeight: 600, color: item.quantity === 0 ? 'var(--risk-light)' : '#fff' }}>
                          {item.quantity != null ? formatNumber(item.quantity) : '—'}
                        </td>
                        <td className="cell-mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {item.reorder_level != null ? formatNumber(item.reorder_level) : '—'}
                        </td>
                        <td>
                          <span className={`pill ${status.class}`}>
                            {getStockStateLabel(status.key, t)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, ratio)}%`,
                                  background: status.color,
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <span className="cell-mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>
                              {ratio}%
                            </span>
                          </div>
                        </td>
                        <td className="cell-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {formatDateTime(item.updated_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card-footer">
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('inventory.tableNote')}
            </span>
            <Link to="/risk-queue" style={{ fontSize: 11.5, color: 'var(--brand-light)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>{t('inventory.crossDomainLink')}</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>

      </div>
    </>
  )
}
