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
} from 'recharts'
import {
  Package,
  RotateCw,
  Search,
  Layers,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import CustomChartTooltip from '../components/CustomChartTooltip.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import InventoryTraceFlow from '../components/InventoryTraceFlow.jsx'
import ProductDetailDrawer from '../components/ProductDetailDrawer.jsx'
import {
  DataPanel,
  Metric,
  SectionHeader,
  CommandSurface,
  VerifiedBadge,
  TechnicalLabel,
  StatusIndicator,
  ActionButton,
  DataTable,
} from '../components/primitives/index.js'
import { fetchInventory, fetchProducts } from '../api.js'
import { useI18n } from '../i18n/index.jsx'

function computeStockState(quantity, reorderLevel) {
  if (quantity == null) return { key: 'UNKNOWN', color: 'var(--text-muted)', status: 'neutral' }
  if (quantity === 0) return { key: 'OUT_OF_STOCK', color: '#f43f5e', status: 'critical' }
  if (reorderLevel != null) {
    if (quantity <= Math.max(1, Math.floor(reorderLevel * 0.5))) {
      return { key: 'CRITICAL', color: '#ff8a65', status: 'critical' }
    }
    if (quantity <= reorderLevel) {
      return { key: 'LOW', color: '#f59e0b', status: 'warning' }
    }
    if (quantity <= Math.floor(reorderLevel * 1.5)) {
      return { key: 'WATCH', color: 'var(--cyan)', status: 'active' }
    }
  }
  return { key: 'HEALTHY', color: '#10b981', status: 'active' }
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
  const [products, setProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('ALL')
  const [showTopology, setShowTopology] = useState(true)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [inspectingProduct, setInspectingProduct] = useState(null)

  const loadData = useCallback(async () => {
    setInventory((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [invData, prodData] = await Promise.all([
        fetchInventory(300, 0),
        fetchProducts({ limit: 300 }),
      ])
      const invList = Array.isArray(invData) ? invData : []
      const prodList = Array.isArray(prodData) ? prodData : []
      setInventory({ loading: false, error: null, data: invList })
      setProducts(prodList)
      if (prodList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodList[0].id)
      }
    } catch (err) {
      setInventory({
        loading: false,
        error: err.message || t('global.error'),
        data: [],
      })
    }
  }, [t, selectedProductId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Map product metadata to inventory items
  const productMap = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p.id, p))
    return map
  }, [products])

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
      { name: t('inventory.statusHealthy'), value: healthyCount, color: '#10b981' },
      { name: t('inventory.statusWatch'), value: watchCount, color: '#06b6d4' },
      { name: t('inventory.statusLow'), value: lowCount, color: '#f59e0b' },
      { name: t('inventory.statusCritical'), value: critCount, color: '#ff8a65' },
      { name: t('inventory.statusOutOfStock'), value: outCount, color: '#f43f5e' },
    ].filter((d) => d.value > 0)
  }, [inventory.data, t])

  // Top items comparing quantity vs reorder level
  const comparisonBarData = useMemo(() => {
    if (!inventory.data || inventory.data.length === 0) return []
    return inventory.data.slice(0, 10).map((item) => {
      const prod = productMap.get(item.product_id)
      return {
        name: prod?.sku || `P${item.product_id}`,
        fullName: prod?.name || `Product #${item.product_id}`,
        quantity: item.quantity ?? 0,
        reorderLevel: item.reorder_level ?? 0,
      }
    })
  }, [inventory.data, productMap])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return inventory.data.filter((item) => {
      const state = computeStockState(item.quantity, item.reorder_level)
      if (stateFilter !== 'ALL' && state.key !== stateFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const prod = productMap.get(item.product_id)
        const name = (prod?.name || '').toLowerCase()
        const sku = (prod?.sku || '').toLowerCase()
        const idStr = String(item.product_id)
        return name.includes(q) || sku.includes(q) || idStr.includes(q)
      }
      return true
    })
  }, [inventory.data, stateFilter, searchQuery, productMap])

  // DataTable columns
  const columns = [
    {
      key: 'product_id',
      header: 'SKU & IDENTIFIER',
      mono: true,
      render: (pId) => {
        const prod = productMap.get(pId)
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>{prod?.sku || `P${pId}`}</span>
              <TechnicalLabel value={`#${pId}`} size="xs" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {prod?.name || 'Catalog Item'}
            </div>
          </div>
        )
      },
    },
    {
      key: 'quantity',
      header: 'STOCK ON HAND',
      align: 'right',
      mono: true,
      render: (qty) => (
        <span style={{ fontWeight: 700, fontSize: 13, color: qty === 0 ? 'var(--risk-light)' : 'var(--text-primary)' }}>
          {qty != null ? formatNumber(qty) : '—'}
        </span>
      ),
    },
    {
      key: 'reorder_level',
      header: 'REORDER LEVEL',
      align: 'right',
      mono: true,
      render: (reorder) => (reorder != null ? formatNumber(reorder) : '—'),
    },
    {
      key: 'buffer_pressure',
      header: 'SAFETY BUFFER RATIO',
      render: (_, row) => {
        const qty = row.quantity ?? 0
        const reorder = row.reorder_level ?? 1
        const ratio = Math.round((qty / (reorder || 1)) * 100)
        const isDepleted = qty === 0
        const isLow = qty <= reorder

        return (
          <div style={{ minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
              <span className="mono" style={{ color: isDepleted ? 'var(--risk-light)' : isLow ? 'var(--ack-light)' : 'var(--resolved-light)' }}>
                {isDepleted ? '0% (Depleted)' : `${ratio}%`}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((qty / (reorder || 1)) * 50))}%`,
                  background: isDepleted ? 'var(--risk-light)' : isLow ? 'var(--ack-light)' : 'var(--cyan)',
                }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'HEALTH STATE',
      render: (_, row) => {
        const state = computeStockState(row.quantity, row.reorder_level)
        return (
          <StatusIndicator
            status={state.status}
            label={getStockStateLabel(state.key, t)}
            size="xs"
          />
        )
      },
    },
    {
      key: 'actions',
      header: 'INSPECT',
      align: 'right',
      render: (_, row) => {
        const prod = productMap.get(row.product_id)
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (prod) setInspectingProduct(prod)
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
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
            <span>Drill Down</span>
            <ArrowRight size={11} />
          </button>
        )
      },
    },
  ]

  return (
    <ErrorBoundary>
      <Topbar
        title={t('inventory.title')}
        subtitle={t('inventory.desc')}
        onRefresh={loadData}
        isRefreshing={inventory.loading}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta={t('inventory.meta')}
          title={t('inventory.title')}
          description={t('inventory.desc')}
          badge={<VerifiedBadge />}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionButton
                variant={showTopology ? 'cyan' : 'subtle'}
                size="sm"
                icon={GitBranch}
                onClick={() => setShowTopology(!showTopology)}
              >
                {showTopology ? 'Hide Trace Topology' : 'Show Trace Topology'}
              </ActionButton>
              <ActionButton
                variant="subtle"
                size="sm"
                icon={RotateCw}
                onClick={loadData}
                loading={inventory.loading}
              >
                Sync Inventory
              </ActionButton>
            </div>
          }
        />

        {/* ── 1. INVENTORY LIFECYCLE TOPOLOGY FLOW (INTERACTIVE) ─────── */}
        {showTopology && (
          <div style={{ marginBottom: 20 }}>
            <InventoryTraceFlow
              products={products}
              inventory={inventory.data}
              selectedProductId={selectedProductId}
              onSelectProduct={setSelectedProductId}
            />
          </div>
        )}

        {/* ── 2. HEALTH DISTRIBUTION & COMPARISON RUNWAY ─────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {/* Inventory Health Donut */}
          <DataPanel
            title="STOCK HEALTH DISTRIBUTION"
            subtitle="Verified on-hand stock vs threshold status"
            icon={Package}
            badge={<VerifiedBadge />}
          >
            <div style={{ height: 160, display: 'flex', alignItems: 'center', padding: '10px 14px' }}>
              {inventoryDonutData.length > 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 140, height: 130, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={inventoryDonutData}
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {inventoryDonutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
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
                        {formatNumber(stockSummary.total)}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                    {inventoryDonutData.map((d, i) => (
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
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Evaluating inventory...</span>
              )}
            </div>
          </DataPanel>

          {/* Quantity vs Reorder Threshold Bar Chart */}
          <DataPanel
            title="QUANTITY VS REORDER LEVEL"
            subtitle="Comparing active stock against threshold"
            icon={Layers}
            badge={<VerifiedBadge />}
          >
            <div style={{ height: 160, padding: '10px 10px 0' }}>
              {comparisonBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar dataKey="quantity" name="Stock On Hand" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="reorderLevel" name="Reorder Level" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  No stock records available
                </div>
              )}
            </div>
          </DataPanel>
        </div>

        {/* ── 3. INVENTORY TELEMETRY TABLE COMMAND SURFACE ─────────────── */}
        <CommandSurface
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Filter inventory by SKU or product name..."
          filters={[
            { id: 'all', label: 'ALL STOCK', active: stateFilter === 'ALL', onClick: () => setStateFilter('ALL'), count: stockSummary.total },
            { id: 'healthy', label: 'HEALTHY', active: stateFilter === 'HEALTHY', onClick: () => setStateFilter('HEALTHY'), count: stockSummary.healthyCount },
            { id: 'low', label: 'LOW STOCK', active: stateFilter === 'LOW', onClick: () => setStateFilter('LOW'), count: stockSummary.lowCount },
            { id: 'critical', label: 'CRITICAL', active: stateFilter === 'CRITICAL', onClick: () => setStateFilter('CRITICAL'), count: stockSummary.critCount },
            { id: 'out', label: 'OUT OF STOCK', active: stateFilter === 'OUT_OF_STOCK', onClick: () => setStateFilter('OUT_OF_STOCK'), count: stockSummary.outCount },
          ]}
          metadata={`${filteredRows.length} RECORDS DISPLAYED`}
        />

        <DataTable
          columns={columns}
          data={filteredRows}
          rowKey={(r) => r.product_id}
          loading={inventory.loading}
          onRowClick={(row) => {
            const prod = productMap.get(row.product_id)
            if (prod) setInspectingProduct(prod)
          }}
          emptyTitle="No Matching Inventory Records"
          emptyDescription="No verified physical stock records meet the current filter criteria."
        />

        {/* Product Detail Progressive Disclosure Drawer */}
        {inspectingProduct && (
          <ProductDetailDrawer
            product={inspectingProduct}
            inventoryItem={inventory.data.find((inv) => inv.product_id === inspectingProduct.id)}
            isOpen={Boolean(inspectingProduct)}
            onClose={() => setInspectingProduct(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}
