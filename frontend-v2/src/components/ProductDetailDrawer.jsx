import React from 'react'
import {
  Package,
  Layers,
  TrendingUp,
  AlertTriangle,
  Coins,
  History,
  Edit2,
  Archive,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import Drawer from './primitives/Drawer.jsx'
import VerifiedBadge from './primitives/VerifiedBadge.jsx'
import TechnicalLabel from './primitives/TechnicalLabel.jsx'
import StatusIndicator from './primitives/StatusIndicator.jsx'
import ActionButton from './primitives/ActionButton.jsx'
import InsightCallout from './primitives/InsightCallout.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function ProductDetailDrawer({
  product,
  inventoryItem,
  isOpen,
  onClose,
  onEdit,
  onArchive,
  onNavigateToInventory,
}) {
  const { t, formatCurrency, formatDateTime } = useI18n()

  if (!product) return null

  const hasInventory = inventoryItem != null
  const quantity = hasInventory ? inventoryItem.quantity : null
  const reorderLevel = hasInventory ? inventoryItem.reorder_level : null

  // Stock status determination
  const getStockStatus = () => {
    if (!hasInventory) return 'neutral'
    if (quantity === 0) return 'critical'
    if (reorderLevel != null && quantity <= reorderLevel) return 'warning'
    return 'active'
  }

  const getStockLabel = () => {
    if (!hasInventory) return 'INVENTORY UNAVAILABLE'
    if (quantity === 0) return 'OUT OF STOCK'
    if (reorderLevel != null && quantity <= reorderLevel) return 'LOW STOCK'
    return 'HEALTHY BUFFER'
  }

  const stockStatus = getStockStatus()
  const retailValue = hasInventory && product.price != null
    ? (Number(product.price) * Number(quantity || 0))
    : null

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      subtitle={`SKU: ${product.sku}`}
      badge={
        <StatusIndicator
          status={product.is_active === false ? 'archived' : stockStatus}
          label={product.is_active === false ? 'ARCHIVED' : getStockLabel()}
        />
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {onEdit && (
              <ActionButton variant="subtle" size="sm" icon={Edit2} onClick={() => onEdit(product)}>
                Edit Product
              </ActionButton>
            )}
            {onArchive && product.is_active !== false && (
              <ActionButton variant="danger" size="sm" icon={Archive} onClick={() => onArchive(product)}>
                Archive
              </ActionButton>
            )}
          </div>
          {onNavigateToInventory && (
            <ActionButton
              variant="cyan"
              size="sm"
              icon={ArrowRight}
              onClick={() => onNavigateToInventory(product)}
            >
              Inspect In Inventory
            </ActionButton>
          )}
        </div>
      }
    >
      {/* 1. Identity & Catalog Metadata */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Package size={13} color="var(--brand-light)" />
          <span>PRODUCT IDENTITY</span>
          <VerifiedBadge />
        </div>

        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>SYSTEM ID</span>
            <TechnicalLabel value={`#${product.id}`} size="xs" variant="brand" />
          </div>
          <div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>CATEGORY</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              {product.category || 'Uncategorized'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>BASE UNIT PRICE</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              ₹{Number(product.price || 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block' }}>CATALOG CREATED</span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {product.created_at ? formatDateTime(product.created_at) : '—'}
            </span>
          </div>
        </div>

        {product.description && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>
            {product.description}
          </p>
        )}
      </div>

      {/* 2. Stock Health & Buffer Pressure */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Layers size={13} color="var(--cyan)" />
          <span>PHYSICAL STOCK HEALTH</span>
          <VerifiedBadge />
        </div>

        {hasInventory ? (
          <div
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ON-HAND QUANTITY</span>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {quantity}{' '}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>units</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>REORDER THRESHOLD</span>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {reorderLevel != null ? `${reorderLevel} units` : 'Not set'}
                </div>
              </div>
            </div>

            {/* Buffer Gauge */}
            {reorderLevel != null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Safety Buffer Ratio</span>
                  <span className="mono">
                    {reorderLevel > 0 ? `${Math.round((quantity / reorderLevel) * 100)}% of threshold` : '—'}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(((quantity || 0) / (reorderLevel || 1)) * 50))}%`,
                      background: quantity <= reorderLevel ? 'var(--risk-light)' : 'var(--cyan)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <InsightCallout type="degraded" title="Inventory Feed Unavailable">
            Physical stock telemetry for this SKU has not been initialized or is currently unreachable.
          </InsightCallout>
        )}
      </div>

      {/* 3. Financial Exposure & Capital Valuation */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Coins size={13} color="var(--resolved-light)" />
          <span>FINANCIAL VALUATION</span>
          <VerifiedBadge />
        </div>

        <div
          style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xs)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ON-HAND RETAIL ASSET VALUE</span>
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--resolved-light)' }}>
              {retailValue != null ? formatCurrency(retailValue) : '—'}
            </div>
          </div>
          <TechnicalLabel value="SQLITE VALUATION" variant="success" size="xs" />
        </div>
      </div>
    </Drawer>
  )
}
