import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, StockRiskIndicator, UserRole, InventoryUpdateRequest } from '../types';
import { fetchProducts, fetchInventoryRisks, updateInventory, ApiError } from '../services/api';

interface InventoryManagerProps {
  businessId: number;
  userRole: UserRole;
  days?: number;
  onInventoryUpdated?: () => void;
}

interface MergedInventoryItem {
  productId: number;
  name: string;
  category: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  reorderLevel: number;
  daysOfInventory: number | null;
  riskLevel: string;
  updatedAt: string;
}

type StockFilter = 'ALL' | 'ATTENTION' | 'OUT_OF_STOCK' | 'HEALTHY';

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  userRole,
  days = 30,
  onInventoryUpdated,
}) => {
  const [items, setItems] = useState<MergedInventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');

  // Adjustment Modal State
  const [selectedItem, setSelectedItem] = useState<MergedInventoryItem | null>(null);
  const [formQuantity, setFormQuantity] = useState<string>('');
  const [formReorderLevel, setFormReorderLevel] = useState<string>('');
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const canMutate = userRole === 'OWNER' || userRole === 'ADMIN';

  // Load authoritative product & inventory state plus deterministic coverage risks
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsData, risksData] = await Promise.all([
        fetchProducts(100, 0),
        fetchInventoryRisks(days).catch(() => [] as StockRiskIndicator[]),
      ]);

      // Build risk lookup by product_id
      const riskMap = new Map<number, StockRiskIndicator>();
      risksData.forEach((r) => riskMap.set(r.product_id, r));

      const merged: MergedInventoryItem[] = productsData.map((p: Product) => {
        const risk = riskMap.get(p.id);
        const qty = p.inventory?.quantity ?? 0;
        const reorder = p.inventory?.reorder_level ?? 10;
        const updated = p.inventory?.updated_at ?? p.created_at;
        return {
          productId: p.id,
          name: p.name,
          category: p.category,
          sku: p.sku,
          unitPrice: p.unit_price,
          quantity: qty,
          reorderLevel: reorder,
          daysOfInventory: risk?.days_of_inventory ?? null,
          riskLevel: risk?.risk_level ?? (qty === 0 ? 'CRITICAL' : qty <= reorder ? 'HIGH' : 'LOW'),
          updatedAt: updated,
        };
      });

      setItems(merged);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load inventory records.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Counts for summary pills
  const counts = useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let healthy = 0;
    items.forEach((item) => {
      if (item.quantity === 0) {
        outOfStock++;
      } else if (item.quantity <= item.reorderLevel) {
        lowStock++;
      } else {
        healthy++;
      }
    });
    return {
      total: items.length,
      outOfStock,
      lowStock,
      attention: outOfStock + lowStock,
      healthy,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (stockFilter === 'OUT_OF_STOCK') {
        return item.quantity === 0;
      }
      if (stockFilter === 'ATTENTION') {
        return item.quantity <= item.reorderLevel;
      }
      if (stockFilter === 'HEALTHY') {
        return item.quantity > item.reorderLevel;
      }
      return true;
    });
  }, [items, searchQuery, stockFilter]);

  const handleOpenAdjustModal = (item: MergedInventoryItem) => {
    setSelectedItem(item);
    setFormQuantity(String(item.quantity));
    setFormReorderLevel(String(item.reorderLevel));
    setModalError(null);
  };

  const handleCloseAdjustModal = () => {
    if (!modalSubmitting) {
      setSelectedItem(null);
      setModalError(null);
    }
  };

  const handleApplyIncrement = (delta: number) => {
    const current = parseInt(formQuantity, 10);
    const base = isNaN(current) ? 0 : current;
    const next = Math.max(0, base + delta);
    setFormQuantity(String(next));
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalError(null);

    const parsedQty = parseInt(formQuantity, 10);
    const parsedReorder = parseInt(formReorderLevel, 10);

    if (isNaN(parsedQty) || parsedQty < 0) {
      setModalError('Stock quantity must be a non-negative integer (0 or greater).');
      return;
    }
    if (isNaN(parsedReorder) || parsedReorder < 0) {
      setModalError('Reorder threshold must be a non-negative integer (0 or greater).');
      return;
    }

    const payload: InventoryUpdateRequest = {
      quantity: parsedQty,
      reorder_level: parsedReorder,
    };

    setModalSubmitting(true);
    try {
      await updateInventory(selectedItem.productId, payload);
      setSelectedItem(null);
      setSuccessNotice(
        `Updated inventory for "${selectedItem.name}" (${selectedItem.sku}): Stock = ${parsedQty}, Reorder Level = ${parsedReorder}.`
      );
      setTimeout(() => setSuccessNotice(null), 4000);

      // Refresh authoritative inventory state
      await loadInventory();

      // Trigger analytics refresh across application
      if (onInventoryUpdated) {
        onInventoryUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update inventory record.';
      setModalError(msg);
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <section className="card" aria-label="Inventory Control">
      {/* Header */}
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 className="card-title">Inventory Control &amp; Stock Levels</h2>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '100px',
                padding: '2px 8px',
              }}
            >
              {counts.total} Tracked Items
            </span>
            {!canMutate && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '100px',
                  padding: '2px 8px',
                }}
              >
                Member · View Only
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Authoritative stock counts, reorder alert thresholds, and real-time days of inventory coverage.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            id="refresh-inventory-btn"
            className="btn btn-secondary"
            onClick={loadInventory}
            disabled={loading}
            title="Refresh inventory from database"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <div className="metric-item" style={{ padding: '0.75rem' }}>
          <div className="metric-label">Total SKUs</div>
          <div className="metric-value" style={{ fontSize: '1.1rem' }}>
            {counts.total}
          </div>
        </div>

        <div
          className="metric-item"
          style={{
            padding: '0.75rem',
            borderLeft: counts.outOfStock > 0 ? '3px solid var(--status-error)' : '1px solid var(--border-color)',
          }}
        >
          <div className="metric-label">Out of Stock</div>
          <div
            className="metric-value"
            style={{
              fontSize: '1.1rem',
              color: counts.outOfStock > 0 ? 'var(--status-error)' : 'var(--text-primary)',
            }}
          >
            {counts.outOfStock}
          </div>
        </div>

        <div
          className="metric-item"
          style={{
            padding: '0.75rem',
            borderLeft: counts.lowStock > 0 ? '3px solid var(--status-pending)' : '1px solid var(--border-color)',
          }}
        >
          <div className="metric-label">Low Stock (≤ Reorder)</div>
          <div
            className="metric-value"
            style={{
              fontSize: '1.1rem',
              color: counts.lowStock > 0 ? 'var(--status-pending)' : 'var(--text-primary)',
            }}
          >
            {counts.lowStock}
          </div>
        </div>

        <div
          className="metric-item"
          style={{
            padding: '0.75rem',
            borderLeft: '3px solid var(--status-success)',
          }}
        >
          <div className="metric-label">Healthy Stock</div>
          <div className="metric-value" style={{ fontSize: '1.1rem', color: 'var(--status-success)' }}>
            {counts.healthy}
          </div>
        </div>
      </div>

      {/* Success Notice */}
      {successNotice && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: 'var(--status-success)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>✓</span>
          <span>{successNotice}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            color: 'var(--status-error)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠ {error}</span>
          <button
            onClick={loadInventory}
            style={{
              background: 'none',
              border: '1px solid var(--status-error)',
              color: 'var(--status-error)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      {items.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Quick Filter Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              id="filter-all-btn"
              onClick={() => setStockFilter('ALL')}
              style={{
                background: stockFilter === 'ALL' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: stockFilter === 'ALL' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                color: stockFilter === 'ALL' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: stockFilter === 'ALL' ? 600 : 400,
              }}
            >
              All ({counts.total})
            </button>

            <button
              id="filter-attention-btn"
              onClick={() => setStockFilter('ATTENTION')}
              style={{
                background: stockFilter === 'ATTENTION' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: stockFilter === 'ATTENTION' ? '1px solid var(--status-pending)' : '1px solid var(--border-color)',
                color: stockFilter === 'ATTENTION' ? 'var(--status-pending)' : 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: stockFilter === 'ATTENTION' ? 600 : 400,
              }}
            >
              Needs Attention ({counts.attention})
            </button>

            <button
              id="filter-out-of-stock-btn"
              onClick={() => setStockFilter('OUT_OF_STOCK')}
              style={{
                background: stockFilter === 'OUT_OF_STOCK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: stockFilter === 'OUT_OF_STOCK' ? '1px solid var(--status-error)' : '1px solid var(--border-color)',
                color: stockFilter === 'OUT_OF_STOCK' ? 'var(--status-error)' : 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: stockFilter === 'OUT_OF_STOCK' ? 600 : 400,
              }}
            >
              Out of Stock ({counts.outOfStock})
            </button>

            <button
              id="filter-healthy-btn"
              onClick={() => setStockFilter('HEALTHY')}
              style={{
                background: stockFilter === 'HEALTHY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: stockFilter === 'HEALTHY' ? '1px solid var(--status-success)' : '1px solid var(--border-color)',
                color: stockFilter === 'HEALTHY' ? 'var(--status-success)' : 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: stockFilter === 'HEALTHY' ? 600 : 400,
              }}
            >
              Healthy ({counts.healthy})
            </button>
          </div>

          {/* Search Input */}
          <input
            id="inventory-search-input"
            type="text"
            placeholder="Search inventory by SKU, name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 200px',
              maxWidth: '300px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '0.4rem 0.75rem',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Loading */}
      {loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.9rem' }}>Loading inventory state…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && items.length === 0 && !error && (
        <div
          style={{
            textAlign: 'center',
            padding: '2.5rem 1.5rem',
            border: '1px dashed var(--border-color)',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.6 }}>📋</div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No Inventory Records
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', maxWidth: '380px', margin: '0 auto' }}>
            Create products in the Product Catalog to automatically initialize their 1-to-1 inventory records.
          </p>
        </div>
      )}

      {/* Filtered Empty State */}
      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.85rem' }}>No inventory items match your current filter or search criteria.</p>
        </div>
      )}

      {/* Inventory Table */}
      {filteredItems.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            id="inventory-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.65rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Product</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Price</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Stock On Hand</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Reorder Level</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Days of Stock</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isOutOfStock = item.quantity === 0;
                const isLowStock = !isOutOfStock && item.quantity <= item.reorderLevel;

                let statusBadgeColor = 'var(--status-success)';
                let statusBadgeBg = 'rgba(16, 185, 129, 0.12)';
                let statusBadgeText = 'In Stock';

                if (isOutOfStock) {
                  statusBadgeColor = 'var(--status-error)';
                  statusBadgeBg = 'rgba(239, 68, 68, 0.15)';
                  statusBadgeText = 'Out of Stock';
                } else if (isLowStock) {
                  statusBadgeColor = 'var(--status-pending)';
                  statusBadgeBg = 'rgba(245, 158, 11, 0.15)';
                  statusBadgeText = 'Low Stock';
                }

                return (
                  <tr
                    key={item.productId}
                    id={`inventory-row-${item.productId}`}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    {/* SKU */}
                    <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--accent-cyan)',
                          background: 'rgba(6, 182, 212, 0.08)',
                          border: '1px solid rgba(6, 182, 212, 0.2)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {item.sku}
                      </span>
                    </td>

                    {/* Product Name & Category */}
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.category}</div>
                    </td>

                    {/* Unit Price */}
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      ${item.unitPrice.toFixed(2)}
                    </td>

                    {/* Stock On Hand */}
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color: statusBadgeColor }}>
                          {item.quantity}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: statusBadgeColor,
                            background: statusBadgeBg,
                            padding: '1px 6px',
                            borderRadius: '100px',
                          }}
                        >
                          {statusBadgeText}
                        </span>
                      </div>
                    </td>

                    {/* Reorder Level */}
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {item.reorderLevel}
                    </td>

                    {/* Days of Stock */}
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      {item.daysOfInventory !== null ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: item.daysOfInventory <= 7 ? 'var(--status-error)' : item.daysOfInventory <= 14 ? 'var(--status-pending)' : 'var(--text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          {item.daysOfInventory.toFixed(1)}d
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canMutate ? (
                        <button
                          id={`adjust-stock-btn-${item.productId}`}
                          className="btn btn-secondary"
                          onClick={() => handleOpenAdjustModal(item)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.78rem',
                            color: 'var(--accent-cyan)',
                            borderColor: 'rgba(6, 182, 212, 0.3)',
                          }}
                        >
                          Adjust Stock
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          disabled
                          title="Only OWNER or ADMIN can adjust inventory"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.78rem',
                            opacity: 0.5,
                          }}
                        >
                          View Only
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Adjust Stock Modal ─── */}
      {selectedItem && (
        <div className="auth-modal-overlay" onClick={handleCloseAdjustModal}>
          <div
            className="auth-modal"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Adjust Inventory
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedItem.name} ({selectedItem.sku})
                </p>
              </div>
              <button
                id="close-adjust-modal-btn"
                onClick={handleCloseAdjustModal}
                disabled={modalSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Error in modal */}
            {modalError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  color: 'var(--status-error)',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                ⚠ {modalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitAdjustment} className="auth-form">
              {/* Stock Quantity */}
              <div className="auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="adjust-quantity">New Stock Quantity (units) *</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Current: {selectedItem.quantity}
                  </span>
                </div>
                <input
                  id="adjust-quantity"
                  type="number"
                  step="1"
                  min="0"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  disabled={modalSubmitting}
                  required
                />
                {/* Quick adjustment helper buttons */}
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {[5, 10, 25, 50].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => handleApplyIncrement(delta)}
                      disabled={modalSubmitting}
                      style={{
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(6, 182, 212, 0.25)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                      }}
                    >
                      +{delta}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormQuantity('0')}
                    disabled={modalSubmitting}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      color: 'var(--status-error)',
                      cursor: 'pointer',
                    }}
                  >
                    Set 0
                  </button>
                </div>
              </div>

              {/* Reorder Threshold */}
              <div className="auth-field" style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="adjust-reorder">Reorder Threshold *</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Current: {selectedItem.reorderLevel}
                  </span>
                </div>
                <input
                  id="adjust-reorder"
                  type="number"
                  step="1"
                  min="0"
                  value={formReorderLevel}
                  onChange={(e) => setFormReorderLevel(e.target.value)}
                  disabled={modalSubmitting}
                  required
                />
                <span className="auth-field-hint">
                  Triggers low-stock alert when quantity on hand falls to or below this level.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseAdjustModal}
                  disabled={modalSubmitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  id="submit-inventory-adjust-btn"
                  type="submit"
                  className="auth-submit-btn"
                  disabled={modalSubmitting}
                  style={{ flex: 2, margin: 0 }}
                >
                  {modalSubmitting ? 'Saving Changes…' : 'Save Inventory Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
