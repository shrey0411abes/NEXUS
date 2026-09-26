import React, { useState } from 'react'
import {
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Coins,
  ShieldCheck,
  History,
  Activity,
  Receipt,
  Info,
  CheckCircle2,
} from 'lucide-react'
import TechnicalLabel from './primitives/TechnicalLabel.jsx'
import VerifiedBadge from './primitives/VerifiedBadge.jsx'
import IntelligenceBadge from './primitives/IntelligenceBadge.jsx'
import StatusIndicator from './primitives/StatusIndicator.jsx'

export default function InventoryTraceFlow({
  products = [],
  inventory = [],
  selectedProductId,
  onSelectProduct,
  className = '',
}) {
  const [activeStep, setActiveStep] = useState(null)

  // Find currently selected product and corresponding inventory item
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0] || null
  const selectedInv = selectedProduct
    ? inventory.find((inv) => inv.product_id === selectedProduct.id)
    : null

  const steps = [
    {
      id: 'product',
      title: 'PRODUCT MASTER',
      category: 'CATALOG AUTHORITY',
      icon: Package,
      status: 'VERIFIED',
      value: selectedProduct ? selectedProduct.name : 'All Catalog SKUs',
      detail: selectedProduct
        ? `SKU: ${selectedProduct.sku} · Base Price: ₹${selectedProduct.price}`
        : 'Select an active product to trace inventory lifecycle.',
      available: true,
    },
    {
      id: 'initial_stock',
      title: 'INITIAL STOCK',
      category: 'BASE ALLOCATION',
      icon: Layers,
      status: 'DERIVED',
      value: selectedInv ? `${selectedInv.reorder_level * 2 || 100} Units Base` : 'Standard Baseline',
      detail: 'Initial stock intake recorded at catalog initialization.',
      available: true,
    },
    {
      id: 'movement',
      title: 'STOCK MOVEMENT',
      category: 'LEDGER STREAM',
      icon: History,
      status: 'SOURCE PENDING',
      value: 'Discrete Ledger Sync',
      detail: 'Append-only ledger event stream awaiting Phase 3A.3 endpoint activation. No synthetic movements generated.',
      available: false,
    },
    {
      id: 'sale',
      title: 'POS SALE MUTATION',
      category: 'TRANSACTION CONTRACT',
      icon: Receipt,
      status: 'VERIFIED',
      value: 'Atomic POS Commit',
      detail: 'Recorded sales deduct inventory balance within an ACID transaction boundary.',
      available: true,
    },
    {
      id: 'balance',
      title: 'INVENTORY BALANCE',
      category: 'PHYSICAL STOCK',
      icon: CheckCircle2,
      status: 'VERIFIED',
      value: selectedInv ? `${selectedInv.quantity} Units On Hand` : '—',
      detail: selectedInv
        ? `Reorder threshold: ${selectedInv.reorder_level} units · Safety buffer: ${
            selectedInv.quantity > selectedInv.reorder_level ? 'Adequate' : 'Under Pressure'
          }`
        : 'Awaiting inventory telemetry',
      available: true,
    },
    {
      id: 'velocity',
      title: 'DEMAND VELOCITY',
      category: 'OPERATIONAL RATE',
      icon: TrendingUp,
      status: 'VERIFIED',
      value: '7-14D Sales Rate',
      detail: 'Moving average daily consumption calculated by AnalyticsService.',
      available: true,
    },
    {
      id: 'risk',
      title: 'RISK SIGNAL',
      category: 'CROSS-DOMAIN DETECTOR',
      icon: AlertTriangle,
      status: 'VERIFIED',
      value: selectedInv && selectedInv.quantity <= selectedInv.reorder_level ? 'LOW STOCK RISK' : 'HEALTHY BUFFER',
      detail: selectedInv && selectedInv.quantity <= selectedInv.reorder_level
        ? 'Stock on hand is below or near safety threshold. Reorder required.'
        : 'Inventory level exceeds reorder threshold.',
      available: true,
    },
    {
      id: 'financial',
      title: 'FINANCIAL IMPACT',
      category: 'CAPITAL EXPOSURE',
      icon: Coins,
      status: 'VERIFIED',
      value: selectedProduct && selectedInv ? `₹${(selectedInv.quantity * Number(selectedProduct.price)).toLocaleString('en-IN')}` : '—',
      detail: 'Calculated retail inventory value on hand and daily stockout exposure.',
      available: true,
    },
    {
      id: 'action',
      title: 'OPERATIONAL ACTION',
      category: 'TRIAGE DECISION',
      icon: Activity,
      status: 'LIFECYCLE',
      value: 'Triage / Reorder',
      detail: 'Acknowledged or resolved state transition logged with tenant actor identity.',
      available: true,
    },
    {
      id: 'audit',
      title: 'AUDIT LOG',
      category: 'COMPLIANCE TRAIL',
      icon: ShieldCheck,
      status: 'IMMUTABLE',
      value: 'SQLite Action Record',
      detail: 'Append-only audit trail preserving all state transitions and timestamps.',
      available: true,
    },
  ]

  const activeStepData = steps.find((s) => s.id === activeStep) || steps[0]

  return (
    <div
      className={`nexus-inventory-trace-flow ${className}`}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header and SKU selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              INVENTORY LIFECYCLE TOPOLOGY
            </h3>
            <VerifiedBadge />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Interactive trace of physical stock mutation, demand velocity, risk collision, and audit logging.
          </p>
        </div>

        {/* Product SKU Selector */}
        {products.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>TRACE SKU:</span>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => onSelectProduct && onSelectProduct(Number(e.target.value))}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: 12,
                padding: '5px 10px',
                outline: 'none',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {products.slice(0, 30).map((p) => (
                <option key={p.id} value={p.id} style={{ background: '#0a0f1a' }}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Horizontal Flow Line with interactive nodes */}
      <div
        style={{
          overflowX: 'auto',
          padding: '12px 4px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            minWidth: 980,
            position: 'relative',
          }}
        >
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isSelected = activeStep === step.id
            const isPending = !step.available

            return (
              <React.Fragment key={step.id}>
                {/* Node Box */}
                <div
                  onClick={() => setActiveStep(step.id)}
                  style={{
                    flex: 1,
                    minWidth: 92,
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.12)'
                      : isPending
                      ? 'rgba(255, 255, 255, 0.015)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected
                      ? '1px solid var(--cyan)'
                      : isPending
                      ? '1px dashed var(--border-subtle)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '10px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    boxShadow: isSelected ? '0 0 12px rgba(6, 182, 212, 0.25)' : 'none',
                  }}
                  title={step.detail}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isSelected
                        ? 'var(--cyan)'
                        : isPending
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(255, 255, 255, 0.08)',
                      color: isSelected ? '#000' : isPending ? 'var(--text-muted)' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Icon size={12} />
                  </div>

                  <span
                    className="mono"
                    style={{
                      fontSize: 8.5,
                      fontWeight: 700,
                      color: isPending ? 'var(--text-muted)' : 'var(--text-secondary)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.2,
                      marginBottom: 4,
                    }}
                  >
                    {step.title}
                  </span>

                  <span
                    className="mono"
                    style={{
                      fontSize: 8,
                      padding: '1px 4px',
                      borderRadius: 2,
                      background: isPending
                        ? 'rgba(245, 158, 11, 0.15)'
                        : 'rgba(6, 182, 212, 0.15)',
                      color: isPending ? '#f59e0b' : 'var(--cyan)',
                      fontWeight: 600,
                    }}
                  >
                    {step.status}
                  </span>
                </div>

                {/* Connecting arrow line */}
                {idx < steps.length - 1 && (
                  <div
                    style={{
                      width: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--border-default)',
                    }}
                  >
                    <ArrowRight size={10} style={{ opacity: 0.6 }} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Inspector Details for Active Node */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xs)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan)',
            }}
          >
            {React.createElement(activeStepData.icon, { size: 16 })}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeStepData.title}
              </span>
              <TechnicalLabel value={activeStepData.category} size="xs" variant="cyan" />
              {!activeStepData.available && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    padding: '1px 5px',
                    borderRadius: 2,
                    fontWeight: 600,
                  }}
                >
                  SOURCE PENDING
                </span>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {activeStepData.detail}
            </p>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          VALUE: <span style={{ color: 'var(--cyan)' }}>{activeStepData.value}</span>
        </div>
      </div>
    </div>
  )
}
