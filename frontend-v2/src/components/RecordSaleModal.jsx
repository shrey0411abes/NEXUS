import React, { useState } from 'react'
import {
  X,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { createTransaction, getCachedUserContext } from '../api.js'
import ActionButton from './primitives/ActionButton.jsx'
import VerifiedBadge from './primitives/VerifiedBadge.jsx'
import TechnicalLabel from './primitives/TechnicalLabel.jsx'
import { useI18n } from '../i18n/index.jsx'

export default function RecordSaleModal({
  isOpen,
  onClose,
  products = [],
  onSuccess,
}) {
  const { t, formatCurrency } = useI18n()
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(products[0]?.price || 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [pipelineState, setPipelineState] = useState(null) // null | 'submitting' | 'success'
  const [createdTxId, setCreatedTxId] = useState(null)

  if (!isOpen) return null

  const handleProductChange = (e) => {
    const pId = Number(e.target.value)
    setSelectedProductId(pId)
    const prod = products.find((p) => p.id === pId)
    if (prod) {
      setUnitPrice(prod.price || 0)
    }
  }

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId))
  const calculatedTotal = (Number(quantity) * Number(unitPrice)).toFixed(2)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProductId || quantity <= 0) {
      setError('Please select a valid product and enter a positive quantity.')
      return
    }

    setSubmitting(true)
    setError(null)
    setPipelineState('submitting')

    try {
      const tenantContext = getCachedUserContext()
      if (!tenantContext?.business_id) {
        setError('Active tenant context unavailable. Please ensure you are authenticated.')
        setSubmitting(false)
        setPipelineState(null)
        return
      }

      const payload = {
        business_id: tenantContext.business_id,
        transaction_type: 'SALE',
        items: [
          {
            product_id: Number(selectedProductId),
            quantity: Number(quantity),
            unit_price: Number(unitPrice),
          },
        ],
      }

      const res = await createTransaction(payload)
      setCreatedTxId(res.id)
      setPipelineState('success')

      setTimeout(() => {
        if (onSuccess) onSuccess(res)
        onClose()
      }, 1800)
    } catch (err) {
      setError(err.message || 'Failed to record transaction. Verify stock availability and permissions.')
      setPipelineState(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="nexus-modal-portal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        className="nexus-modal-backdrop"
        onClick={() => !submitting && onClose()}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 8, 15, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          zIndex: 1001,
          overflow: 'hidden',
          animation: 'nexusFadeIn 0.18s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-panel)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} color="var(--brand-light)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              RECORD SALE TRANSACTION
            </h3>
            <VerifiedBadge />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Pipeline Success State */}
        {pipelineState === 'success' ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--resolved-light)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <CheckCircle2 size={24} />
            </div>

            <div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                TRANSACTION COMMITTED
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Authoritative transaction #{createdTxId} recorded in SQLite database.
              </p>
            </div>

            {/* Visual Relationship Chain */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ color: 'var(--brand-light)', fontWeight: 600 }}>1. SALE CREATED</div>
              <ArrowRight size={12} color="var(--border-default)" />
              <div style={{ color: 'var(--cyan)', fontWeight: 600 }}>2. STOCK DEDUCTED</div>
              <ArrowRight size={12} color="var(--border-default)" />
              <div style={{ color: 'var(--resolved-light)', fontWeight: 600 }}>3. TELEMETRY REFRESHED</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--risk-light)',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Product Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                SELECT PRODUCT
              </label>
              <select
                value={selectedProductId}
                onChange={handleProductChange}
                required
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: '#0a0f1a' }}>
                    {p.sku} — {p.name} (₹{p.price})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity and Unit Price Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  QUANTITY (UNITS)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  UNIT PRICE (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Calculated Order Summary Box */}
            <div
              style={{
                background: 'rgba(6, 182, 212, 0.05)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                borderRadius: 'var(--radius-xs)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  CALCULATED TOTAL AMOUNT
                </span>
                <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--cyan)' }}>
                  ₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <TechnicalLabel value="SQLITE ACID" variant="cyan" size="xs" />
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <ActionButton variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </ActionButton>
              <ActionButton type="submit" variant="primary" loading={submitting}>
                Record & Deduct Stock
              </ActionButton>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
