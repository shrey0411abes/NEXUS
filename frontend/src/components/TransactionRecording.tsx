import React, { useState, useEffect, useCallback } from 'react';
import { fetchProducts, createTransaction, ApiError } from '../services/api';
import { Product, TransactionType, TransactionItemCreate } from '../types';

type UserRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface LineItem {
  product: Product;
  quantity: number;
}

interface TransactionRecordingProps {
  businessId: number;
  userRole: UserRole;
  onTransactionComplete: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TX_LABELS: Record<TransactionType, string> = { sale: 'Sale', purchase: 'Purchase', refund: 'Refund', adjustment: 'Adjustment' };

export const TransactionRecording: React.FC<TransactionRecordingProps> = ({ businessId, userRole, onTransactionComplete }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [transactionType, setTransactionType] = useState<TransactionType>('sale');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ id: number; total_amount: number; transaction_date: string; item_count: number } | null>(null);

  const canWrite = userRole === 'OWNER' || userRole === 'ADMIN';

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      setProducts(await fetchProducts(200, 0));
    } catch (e) {
      setProductsError(e instanceof ApiError ? e.message : 'Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const addItem = (product: Product) =>
    setLineItems((prev) => {
      const ex = prev.find((li) => li.product.id === product.id);
      return ex
        ? prev.map((li) => li.product.id === product.id ? { ...li, quantity: li.quantity + 1 } : li)
        : [...prev, { product, quantity: 1 }];
    });

  const removeItem = (id: number) => setLineItems((prev) => prev.filter((li) => li.product.id !== id));

  const updateQty = (id: number, raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setLineItems((prev) => prev.map((li) => li.product.id === id ? { ...li, quantity: n } : li));
  };

  const clearCart = () => { setLineItems([]); setSubmitError(null); setLastReceipt(null); };

  const grandTotal = lineItems.reduce((acc, li) => acc + li.product.unit_price * li.quantity, 0);

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
  });

  const handleSubmit = async () => {
    if (!canWrite || lineItems.length === 0) { setSubmitError('Add at least one product.'); return; }
    setSubmitting(true); setSubmitError(null);
    const items: TransactionItemCreate[] = lineItems.map((li) => ({
      product_id: li.product.id, quantity: li.quantity, unit_price: li.product.unit_price,
    }));
    try {
      const result = await createTransaction({ business_id: businessId, transaction_type: transactionType, total_amount: null, items });
      setLastReceipt({ id: result.id, total_amount: result.total_amount, transaction_date: result.transaction_date, item_count: result.items.length });
      setLineItems([]); setSearchQuery(''); onTransactionComplete();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Failed to record transaction.');
    } finally { setSubmitting(false); }
  };

  const btnBase: React.CSSProperties = {
    borderRadius: '0.3rem', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.5rem', height: '1.5rem',
  };

  return (
    <div className="card" style={{ marginBottom: '2rem' }}>
      <div className="card-header">
        <div>
          <h2 className="card-title">Point of Sale &middot; Transaction Recording</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>M5-S3 &middot; OWNER / ADMIN only &middot; backend-authoritative</p>
        </div>
        <span style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: canWrite ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: canWrite ? 'var(--accent-green)' : '#ef4444' }}>
          {canWrite ? 'WRITE ACCESS' : 'READ ONLY (MEMBER)'}
        </span>
      </div>

      {!canWrite && (
        <div style={{ margin: '1rem 0', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.85rem' }}>
          Transaction creation requires OWNER or ADMIN role. Current role: {userRole}.
        </div>
      )}

      {lastReceipt && (
        <div style={{ margin: '1rem 0', padding: '1rem 1.25rem', borderRadius: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ color: 'var(--accent-green)', fontWeight: 700 }}>Transaction #{lastReceipt.id} recorded</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{lastReceipt.item_count} item{lastReceipt.item_count !== 1 ? 's' : ''} &middot; {formatDate(lastReceipt.transaction_date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-green)' }}>{formatCurrency(lastReceipt.total_amount)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>backend-computed</div>
            </div>
          </div>
          <button onClick={clearCart} style={{ marginTop: '0.75rem', padding: '0.4rem 1rem', borderRadius: '0.4rem', border: '1px solid rgba(16,185,129,0.4)', background: 'transparent', color: 'var(--accent-green)', fontSize: '0.8rem', cursor: 'pointer' }}>
            New Transaction
          </button>
        </div>
      )}

      {canWrite && !lastReceipt && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', marginTop: '1rem' }}>

          {/* LEFT: Product browser */}
          <div>
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="pos-product-search" type="text" placeholder="Search by name, SKU, or category..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, padding: '0.55rem 0.9rem', borderRadius: '0.5rem', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', minWidth: '180px' }} />
              <select id="pos-transaction-type" value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                style={{ padding: '0.55rem 0.9rem', borderRadius: '0.5rem', border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                {(Object.keys(TX_LABELS) as TransactionType[]).map((t) => <option key={t} value={t}>{TX_LABELS[t]}</option>)}
              </select>
            </div>

            {productsLoading && <div style={{ color: 'var(--text-muted)', padding: '1rem 0', fontSize: '0.85rem' }}>Loading products...</div>}
            {productsError && <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{productsError}</div>}
            {!productsLoading && filtered.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>{searchQuery ? 'No products match.' : 'No products in catalog.'}</div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.75rem', maxHeight: '480px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {filtered.map((product) => {
                const inCart = lineItems.find((li) => li.product.id === product.id);
                const stockQty = product.inventory?.quantity ?? null;
                const outOfStock = transactionType === 'sale' && stockQty !== null && stockQty <= 0;
                const lowStock = stockQty !== null && stockQty > 0 && stockQty <= (product.inventory?.reorder_level ?? 0);
                return (
                  <button key={product.id} id={`pos-product-${product.id}`} onClick={() => !outOfStock && addItem(product)} disabled={outOfStock}
                    style={{ textAlign: 'left', padding: '0.75rem', borderRadius: '0.65rem',
                      border: inCart ? '2px solid var(--accent-cyan)' : '1px solid var(--border-primary)',
                      background: inCart ? 'rgba(6,182,212,0.06)' : outOfStock ? 'rgba(239,68,68,0.04)' : 'var(--bg-tertiary)',
                      cursor: outOfStock ? 'not-allowed' : 'pointer', opacity: outOfStock ? 0.55 : 1, transition: 'all 0.15s ease' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-purple)', fontWeight: 600, marginBottom: '0.2rem', letterSpacing: '0.04em' }}>{product.category.toUpperCase()}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.15rem', lineHeight: 1.3 }}>{product.name}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>SKU: {product.sku}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-cyan)' }}>{formatCurrency(product.unit_price)}</span>
                      {stockQty !== null && (
                        <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: 600,
                          background: outOfStock ? 'rgba(239,68,68,0.15)' : lowStock ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)',
                          color: outOfStock ? '#ef4444' : lowStock ? '#f59e0b' : 'var(--accent-green)' }}>
                          {outOfStock ? 'Out of Stock' : `${stockQty} in stock`}
                        </span>
                      )}
                    </div>
                    {inCart && <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>{inCart.quantity}x in cart</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Order summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-primary)' }}>
              Order Summary <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{TX_LABELS[transactionType]}</span>
            </div>

            {lineItems.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center', padding: '2rem 0' }}>Select products from the catalog</div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '320px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {lineItems.map((li) => (
                  <div key={li.product.id} style={{ padding: '0.6rem 0.75rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.product.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatCurrency(li.product.unit_price)} each</div>
                      </div>
                      <button id={`pos-remove-${li.product.id}`} onClick={() => removeItem(li.product.id)}
                        style={{ padding: '0.1rem 0.4rem', borderRadius: '0.3rem', border: '1px solid rgba(239,68,68,0.35)', background: 'transparent', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>x</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button id={`pos-dec-${li.product.id}`} onClick={() => li.quantity === 1 ? removeItem(li.product.id) : updateQty(li.product.id, String(li.quantity - 1))} style={btnBase}>-</button>
                        <input id={`pos-qty-${li.product.id}`} type="number" min={1} value={li.quantity} onChange={(e) => updateQty(li.product.id, e.target.value)}
                          style={{ width: '3rem', textAlign: 'center', padding: '0.2rem', borderRadius: '0.3rem', border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                        <button id={`pos-inc-${li.product.id}`} onClick={() => updateQty(li.product.id, String(li.quantity + 1))} style={btnBase}>+</button>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatCurrency(li.product.unit_price * li.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {lineItems.length > 0 && (
              <>
                <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Preview total</span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatCurrency(grandTotal)}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>Backend computes and persists the authoritative total.</div>
              </>
            )}

            {submitError && (
              <div style={{ padding: '0.6rem 0.9rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.82rem' }}>{submitError}</div>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: 'auto' }}>
              <button id="pos-clear-cart" onClick={clearCart} disabled={lineItems.length === 0 || submitting}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: lineItems.length === 0 || submitting ? 'not-allowed' : 'pointer', opacity: lineItems.length === 0 || submitting ? 0.5 : 1 }}>Clear</button>
              <button id="pos-submit" onClick={handleSubmit} disabled={lineItems.length === 0 || submitting}
                style={{ flex: 2, padding: '0.6rem', borderRadius: '0.5rem', border: 'none',
                  background: lineItems.length === 0 || submitting ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                  color: lineItems.length === 0 || submitting ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: '0.875rem',
                  cursor: lineItems.length === 0 || submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Recording...' : `Record ${TX_LABELS[transactionType]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionRecording;
