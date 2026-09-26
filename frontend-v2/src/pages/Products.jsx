import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Boxes,
  Plus,
  RotateCw,
  Search,
  Filter,
  Edit2,
  Archive,
  AlertTriangle,
  CheckCircle,
  X,
  Package,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import Topbar from '../components/Topbar.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
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
import {
  fetchProducts,
  createProduct,
  updateProduct,
  archiveProduct,
  fetchInventory,
  fetchCurrentUser,
  getCachedUserContext,
} from '../api.js'
import { useI18n } from '../i18n/index.jsx'
import { useNavigate } from 'react-router-dom'

export default function Products({ onToggleMobileMenu }) {
  const { t, formatNumber, formatDateTime } = useI18n()
  const navigate = useNavigate()

  // Data streams
  const [productsState, setProductsState] = useState({ loading: true, error: null, data: [] })
  const [inventoryState, setInventoryState] = useState({ loading: true, error: null, data: [] })
  const [userContext, setUserContext] = useState(getCachedUserContext())

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL') // ALL, ACTIVE, ARCHIVED

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [archivingProduct, setArchivingProduct] = useState(null)
  const [inspectingProduct, setInspectingProduct] = useState(null)

  // Feedback notifications / form errors
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auth context
  useEffect(() => {
    let isMounted = true
    fetchCurrentUser()
      .then((data) => {
        if (isMounted) setUserContext(data)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  const isMember = useMemo(() => {
    return userContext?.role === 'MEMBER' || userContext?.user?.role === 'MEMBER'
  }, [userContext])

  // Load Products (Stream 1)
  const loadProducts = useCallback(async () => {
    setProductsState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchProducts({ include_archived: true, limit: 1000 })
      setProductsState({
        loading: false,
        error: null,
        data: Array.isArray(data) ? data : [],
      })
    } catch (err) {
      setProductsState({
        loading: false,
        error: err.message || t('global.error'),
        data: [],
      })
    }
  }, [t])

  // Load Inventory (Stream 2)
  const loadInventory = useCallback(async () => {
    setInventoryState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const data = await fetchInventory(1000, 0)
      setInventoryState({
        loading: false,
        error: null,
        data: Array.isArray(data) ? data : [],
      })
    } catch (err) {
      setInventoryState({
        loading: false,
        error: err.message || t('global.error'),
        data: [],
      })
    }
  }, [t])

  const reloadAll = useCallback(() => {
    loadProducts()
    loadInventory()
  }, [loadProducts, loadInventory])

  useEffect(() => {
    reloadAll()
  }, [reloadAll])

  // Build inventory map: product_id -> inventory item
  const inventoryMap = useMemo(() => {
    const map = new Map()
    if (Array.isArray(inventoryState.data)) {
      for (const item of inventoryState.data) {
        if (item.product_id != null) {
          map.set(item.product_id, item)
        }
      }
    }
    return map
  }, [inventoryState.data])

  // Extract distinct categories
  const distinctCategories = useMemo(() => {
    const categories = new Set()
    for (const p of productsState.data) {
      if (p.category && p.category.trim()) {
        categories.add(p.category.trim())
      }
    }
    return Array.from(categories).sort()
  }, [productsState.data])

  // Summary KPIs
  const summaryKpis = useMemo(() => {
    const list = productsState.data || []
    let activeCount = 0
    let archivedCount = 0
    let withInventoryCount = 0

    list.forEach((p) => {
      if (p.is_active) {
        activeCount++
      } else {
        archivedCount++
      }
      if (inventoryMap.has(p.id)) {
        withInventoryCount++
      }
    })

    return {
      total: list.length,
      active: activeCount,
      archived: archivedCount,
      withInventory: inventoryState.error ? null : withInventoryCount,
    }
  }, [productsState.data, inventoryMap, inventoryState.error])

  // Filtered rows
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return productsState.data.filter((product) => {
      if (query) {
        const matchesName = product.name?.toLowerCase().includes(query)
        const matchesSku = product.sku?.toLowerCase().includes(query)
        const matchesCategory = product.category?.toLowerCase().includes(query)
        if (!matchesName && !matchesSku && !matchesCategory) return false
      }
      if (categoryFilter !== 'ALL' && product.category !== categoryFilter) return false
      if (statusFilter === 'ACTIVE' && !product.is_active) return false
      if (statusFilter === 'ARCHIVED' && product.is_active) return false
      return true
    })
  }, [productsState.data, searchQuery, categoryFilter, statusFilter])

  // Actions
  const handleCreateProduct = async (formData) => {
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await createProduct({
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        category: formData.category.trim(),
        unit_price: parseFloat(formData.unit_price) || 0,
        initial_quantity: parseInt(formData.initial_quantity, 10) || 0,
        reorder_level: parseInt(formData.reorder_level, 10) || 0,
      })
      setIsAddModalOpen(false)
      setActionSuccess(t('products.createSuccess'))
      reloadAll()
    } catch (err) {
      if (err.status === 409) {
        setActionError(t('products.skuConflictError'))
      } else {
        setActionError(err.message || t('products.validationError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateProduct = async (formData) => {
    if (!editingProduct) return
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await updateProduct(editingProduct.id, {
        name: formData.name?.trim(),
        sku: formData.sku?.trim(),
        category: formData.category?.trim(),
        unit_price: parseFloat(formData.unit_price) || 0,
      })
      setEditingProduct(null)
      setActionSuccess(t('products.updateSuccess'))
      loadProducts()
    } catch (err) {
      if (err.status === 409) {
        setActionError(t('products.skuConflictError'))
      } else {
        setActionError(err.message || t('products.validationError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchiveProduct = async () => {
    if (!archivingProduct) return
    setIsSubmitting(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await archiveProduct(archivingProduct.id)
      setArchivingProduct(null)
      setActionSuccess(t('products.archiveSuccess'))
      loadProducts()
    } catch (err) {
      setActionError(err.message || t('global.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // DataTable columns
  const columns = [
    {
      key: 'name',
      header: 'PRODUCT & SYSTEM ID',
      render: (_, product) => (
        <div>
          <div style={{ fontWeight: 600, color: product.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {product.name}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
            ID #{product.id}
          </div>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU CODE',
      mono: true,
      render: (sku) => (
        <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{sku}</span>
      ),
    },
    {
      key: 'category',
      header: 'CATEGORY',
      render: (cat) => <span style={{ color: 'var(--text-secondary)' }}>{cat || '—'}</span>,
    },
    {
      key: 'unit_price',
      header: 'BASE UNIT PRICE',
      align: 'right',
      mono: true,
      render: (price) => (
        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          ₹{price != null ? Number(price).toFixed(2) : '0.00'}
        </span>
      ),
    },
    {
      key: 'stock',
      header: 'STOCK ON HAND',
      align: 'right',
      mono: true,
      render: (_, product) => {
        const inv = inventoryMap.get(product.id)
        const stockVal = inv?.quantity ?? null
        if (stockVal == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
        return (
          <span style={{ fontWeight: 700, color: stockVal === 0 ? 'var(--risk-light)' : 'var(--text-primary)' }}>
            {formatNumber(stockVal)}
          </span>
        )
      },
    },
    {
      key: 'reorder',
      header: 'REORDER LEVEL',
      align: 'right',
      mono: true,
      render: (_, product) => {
        const inv = inventoryMap.get(product.id)
        const reorderVal = inv?.reorder_level ?? null
        return reorderVal != null ? formatNumber(reorderVal) : <span style={{ color: 'var(--text-muted)' }}>—</span>
      },
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (_, product) => (
        <StatusIndicator
          status={product.is_active ? 'active' : 'archived'}
          label={product.is_active ? 'ACTIVE' : 'ARCHIVED'}
          size="xs"
        />
      ),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      align: 'right',
      render: (_, product) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {!isMember && (
            <>
              <button
                type="button"
                onClick={() => setEditingProduct(product)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-secondary)',
                  padding: '4px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Edit2 size={11} />
                <span>Edit</span>
              </button>

              {product.is_active && (
                <button
                  type="button"
                  onClick={() => setArchivingProduct(product)}
                  style={{
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--risk-light)',
                    padding: '4px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Archive size={11} />
                  <span>Archive</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setInspectingProduct(product)}
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
              gap: 3,
            }}
          >
            <span>Inspect</span>
            <ArrowRight size={11} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <ErrorBoundary>
      <Topbar onToggleMobileMenu={onToggleMobileMenu} />

      <div className="page-content">
        {/* Section Header */}
        <SectionHeader
          meta={t('products.meta')}
          title={t('products.title')}
          description={t('products.subtitle')}
          badge={<VerifiedBadge />}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!isMember && (
                <ActionButton
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setActionError(null)
                    setIsAddModalOpen(true)
                  }}
                >
                  {t('products.addProductBtn')}
                </ActionButton>
              )}
              <ActionButton
                variant="subtle"
                size="sm"
                icon={RotateCw}
                onClick={reloadAll}
                loading={productsState.loading || inventoryState.loading}
              >
                {t('global.refresh')}
              </ActionButton>
            </div>
          }
        />

        {/* Member Read-Only Notice */}
        {isMember && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              marginBottom: 20,
              fontSize: 12.5,
            }}
          >
            <ShieldAlert size={18} color="var(--ack-light)" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--ack-light)', marginRight: 6 }}>
                {t('products.memberNoticeTitle')}:
              </strong>
              <span style={{ color: 'var(--text-secondary)' }}>
                {t('products.memberNoticeDesc')}
              </span>
            </div>
          </div>
        )}

        {/* Action Success / Error Banners */}
        {actionSuccess && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              marginBottom: 16,
              color: 'var(--resolved-light)',
              fontSize: 12.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={15} />
              <span>{actionSuccess}</span>
            </div>
            <button type="button" onClick={() => setActionSuccess(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {actionError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 16px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              marginBottom: 16,
              color: 'var(--risk-light)',
              fontSize: 12.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} />
              <span>{actionError}</span>
            </div>
            <button type="button" onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Summary KPI Grid ────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Metric
            label={t('products.kpiTotalProducts')}
            value={formatNumber(summaryKpis.total)}
            verified
            icon={Package}
            changeLabel={t('products.kpiTotalProductsSub')}
          />
          <Metric
            label={t('products.kpiActiveSkus')}
            value={formatNumber(summaryKpis.active)}
            verified
            icon={CheckCircle}
            changeDirection="positive"
            changeLabel={t('products.kpiActiveSkusSub')}
          />
          <Metric
            label={t('products.kpiArchivedSkus')}
            value={formatNumber(summaryKpis.archived)}
            icon={Archive}
            changeDirection="neutral"
            changeLabel={t('products.kpiArchivedSkusSub')}
          />
          <Metric
            label={t('products.kpiWithInventory')}
            value={summaryKpis.withInventory != null ? formatNumber(summaryKpis.withInventory) : '—'}
            verified
            icon={Layers}
            changeLabel={t('products.kpiWithInventorySub')}
          />
        </div>

        {/* ── Filters & Command Surface Bar ───────────────────────────── */}
        <CommandSurface
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t('products.searchPlaceholder')}
          filters={[
            { id: 'all', label: 'ALL SKUS', active: statusFilter === 'ALL', onClick: () => setStatusFilter('ALL'), count: summaryKpis.total },
            { id: 'active', label: 'ACTIVE', active: statusFilter === 'ACTIVE', onClick: () => setStatusFilter('ACTIVE'), count: summaryKpis.active },
            { id: 'archived', label: 'ARCHIVED', active: statusFilter === 'ARCHIVED', onClick: () => setStatusFilter('ARCHIVED'), count: summaryKpis.archived },
          ]}
          metadata={`${filteredProducts.length} CATALOG RECORDS`}
          actions={
            distinctCategories.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CATEGORY:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '4px 10px',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                >
                  <option value="ALL" style={{ background: '#0a0f1a' }}>All Categories</option>
                  {distinctCategories.map((c) => (
                    <option key={c} value={c} style={{ background: '#0a0f1a' }}>{c}</option>
                  ))}
                </select>
              </div>
            )
          }
        />

        {/* ── Products DataTable ──────────────────────────────────────── */}
        <DataTable
          columns={columns}
          data={filteredProducts}
          rowKey={(p) => p.id}
          loading={productsState.loading}
          onRowClick={(p) => setInspectingProduct(p)}
          emptyTitle={t('products.emptyCatalog')}
          emptyDescription="No catalog products meet the active filter and search criteria."
        />

        {/* ── Product Detail Progressive Disclosure Drawer ────────────── */}
        {inspectingProduct && (
          <ProductDetailDrawer
            product={inspectingProduct}
            inventoryItem={inventoryMap.get(inspectingProduct.id)}
            isOpen={Boolean(inspectingProduct)}
            onClose={() => setInspectingProduct(null)}
            onEdit={!isMember ? (prod) => {
              setInspectingProduct(null)
              setEditingProduct(prod)
            } : undefined}
            onArchive={!isMember ? (prod) => {
              setInspectingProduct(null)
              setArchivingProduct(prod)
            } : undefined}
            onNavigateToInventory={() => {
              setInspectingProduct(null)
              navigate('/inventory')
            }}
          />
        )}

        {/* Add Product Modal */}
        {isAddModalOpen && (
          <AddProductModal
            onClose={() => setIsAddModalOpen(false)}
            onSubmit={handleCreateProduct}
            isSubmitting={isSubmitting}
            error={actionError}
            t={t}
          />
        )}

        {/* Edit Product Modal */}
        {editingProduct && (
          <EditProductModal
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSubmit={handleUpdateProduct}
            isSubmitting={isSubmitting}
            error={actionError}
            t={t}
          />
        )}

        {/* Archive Confirmation Modal */}
        {archivingProduct && (
          <ArchiveConfirmModal
            product={archivingProduct}
            onClose={() => setArchivingProduct(null)}
            onConfirm={handleArchiveProduct}
            isSubmitting={isSubmitting}
            error={actionError}
            t={t}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function AddProductModal({ onClose, onSubmit, isSubmitting, error, t }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unit_price: '',
    initial_quantity: '0',
    reorder_level: '10',
  })
  const [validationMsg, setValidationMsg] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setValidationMsg('Product name is required')
      return
    }
    if (!formData.sku.trim()) {
      setValidationMsg('SKU code is required')
      return
    }
    if (!formData.category.trim()) {
      setValidationMsg('Category is required')
      return
    }
    const priceNum = parseFloat(formData.unit_price)
    if (isNaN(priceNum) || priceNum < 0) {
      setValidationMsg('Selling price must be a non-negative number')
      return
    }
    onSubmit(formData)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px 28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('products.modalAddTitle')}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, margin: '4px 0 20px 0' }}>
          {t('products.modalAddSubtitle')}
        </p>

        {(error || validationMsg) && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--risk-light)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {validationMsg || error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              {t('products.fieldName')} *
            </label>
            <input
              type="text"
              required
              placeholder={t('products.fieldNamePlaceholder')}
              value={formData.name}
              onChange={(e) => {
                setValidationMsg(null)
                setFormData({ ...formData, name: e.target.value })
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldSku')} *
              </label>
              <input
                type="text"
                required
                placeholder={t('products.fieldSkuPlaceholder')}
                value={formData.sku}
                onChange={(e) => {
                  setValidationMsg(null)
                  setFormData({ ...formData, sku: e.target.value })
                }}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldCategory')} *
              </label>
              <input
                type="text"
                required
                placeholder={t('products.fieldCategoryPlaceholder')}
                value={formData.category}
                onChange={(e) => {
                  setValidationMsg(null)
                  setFormData({ ...formData, category: e.target.value })
                }}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              {t('products.fieldSellingPrice')} *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              placeholder={t('products.fieldSellingPricePlaceholder')}
              value={formData.unit_price}
              onChange={(e) => {
                setValidationMsg(null)
                setFormData({ ...formData, unit_price: e.target.value })
              }}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldInitialStock')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder={t('products.fieldInitialStockPlaceholder')}
                value={formData.initial_quantity}
                onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldReorderLevel')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder={t('products.fieldReorderLevelPlaceholder')}
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <ActionButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {t('global.cancel')}
            </ActionButton>
            <ActionButton type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? t('products.btnCreating') : t('products.btnAddSubmit')}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditProductModal({ product, onClose, onSubmit, isSubmitting, error, t }) {
  const [formData, setFormData] = useState({
    name: product.name || '',
    sku: product.sku || '',
    category: product.category || '',
    unit_price: product.unit_price != null ? String(product.unit_price) : '',
  })
  const [validationMsg, setValidationMsg] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setValidationMsg('Product name cannot be empty')
      return
    }
    if (!formData.sku.trim()) {
      setValidationMsg('SKU code cannot be empty')
      return
    }
    if (!formData.category.trim()) {
      setValidationMsg('Category cannot be empty')
      return
    }
    const priceNum = parseFloat(formData.unit_price)
    if (isNaN(priceNum) || priceNum < 0) {
      setValidationMsg('Selling price must be a non-negative number')
      return
    }
    onSubmit(formData)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          width: '100%',
          maxWidth: 480,
          padding: '24px 28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('products.modalEditTitle')}
          </h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, margin: '4px 0 20px 0' }}>
          {t('products.modalEditSubtitle')}
        </p>

        {(error || validationMsg) && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--risk-light)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {validationMsg || error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              {t('products.fieldName')}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                setValidationMsg(null)
                setFormData({ ...formData, name: e.target.value })
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldSku')}
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => {
                  setValidationMsg(null)
                  setFormData({ ...formData, sku: e.target.value })
                }}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                {t('products.fieldCategory')}
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => {
                  setValidationMsg(null)
                  setFormData({ ...formData, category: e.target.value })
                }}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
              {t('products.fieldSellingPrice')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.unit_price}
              onChange={(e) => {
                setValidationMsg(null)
                setFormData({ ...formData, unit_price: e.target.value })
              }}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <ActionButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
              {t('global.cancel')}
            </ActionButton>
            <ActionButton type="submit" variant="primary" loading={isSubmitting}>
              {isSubmitting ? t('products.btnSaving') : t('products.btnEditSubmit')}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  )
}

function ArchiveConfirmModal({ product, onClose, onConfirm, isSubmitting, error, t }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
          width: '100%',
          maxWidth: 460,
          padding: '24px 28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(244, 63, 94, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--risk-light)',
            }}
          >
            <Archive size={20} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {t('products.modalArchiveTitle')}
          </h3>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
          {t('products.modalArchiveWarning')}
        </p>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 20,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--brand-light)',
          }}
        >
          {t('products.modalArchiveSkuNotice', { sku: product.sku, name: product.name })}
        </div>

        {error && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: 'var(--risk-light)',
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <ActionButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('global.cancel')}
          </ActionButton>
          <ActionButton variant="danger" onClick={onConfirm} loading={isSubmitting}>
            {isSubmitting ? t('products.btnArchiving') : t('products.btnArchiveConfirm')}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xs)',
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color 0.15s ease',
}
