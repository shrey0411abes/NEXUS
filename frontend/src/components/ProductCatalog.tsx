import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, ProductCreateRequest, UserRole } from '../types';
import { fetchProducts, createProduct, ApiError } from '../services/api';

interface ProductCatalogProps {
  businessId: number;
  userRole: UserRole;
}

const PRESET_CATEGORIES = [
  'Beverages',
  'Food & Pantry',
  'Apparel & Accessories',
  'Home Goods',
  'Electronics & Hardware',
  'Health & Beauty',
  'General Merchandise',
];

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  businessId,
  userRole,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formSku, setFormSku] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formQuantity, setFormQuantity] = useState<string>('0');
  const [formReorderLevel, setFormReorderLevel] = useState<string>('10');
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const canCreate = userRole === 'OWNER' || userRole === 'ADMIN';

  // Load products from backend source of truth
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProducts(100, 0);
      setProducts(data);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load product catalog.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Derived categories from existing catalog
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'ALL' || p.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleOpenModal = () => {
    setFormName('');
    setFormCategory('');
    setFormSku('');
    setFormPrice('');
    setFormQuantity('0');
    setFormReorderLevel('10');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!formSubmitting) {
      setIsModalOpen(false);
      setFormError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side UX validation
    const trimmedName = formName.trim();
    const trimmedCategory = formCategory.trim();
    const trimmedSku = formSku.trim().toUpperCase();
    const numPrice = parseFloat(formPrice);
    const numQuantity = parseInt(formQuantity, 10);
    const numReorder = parseInt(formReorderLevel, 10);

    if (!trimmedName) {
      setFormError('Product name is required.');
      return;
    }
    if (!trimmedCategory) {
      setFormError('Category is required.');
      return;
    }
    if (!trimmedSku) {
      setFormError('SKU code is required.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('Unit price must be a valid non-negative number.');
      return;
    }
    if (isNaN(numQuantity) || numQuantity < 0) {
      setFormError('Initial quantity must be a non-negative integer.');
      return;
    }
    if (isNaN(numReorder) || numReorder < 0) {
      setFormError('Reorder level must be a non-negative integer.');
      return;
    }

    const payload: ProductCreateRequest = {
      name: trimmedName,
      category: trimmedCategory,
      sku: trimmedSku,
      unit_price: Math.round(numPrice * 100) / 100,
      business_id: businessId,
      initial_quantity: numQuantity,
      reorder_level: numReorder,
    };

    setFormSubmitting(true);
    try {
      const created = await createProduct(payload);
      setIsModalOpen(false);
      setSuccessToast(`Product "${created.name}" (SKU: ${created.sku}) created successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
      // Refresh authoritative product list from database
      await loadProducts();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create product.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <section className="card" aria-label="Product Catalog">
      {/* Header */}
      <div className="card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 className="card-title">Product Catalog &amp; SKU Registry</h2>
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
              {products.length} {products.length === 1 ? 'SKU' : 'SKUs'}
            </span>
            {!canCreate && (
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
            Manage catalog items, SKU pricing, and baseline inventory thresholds for your business.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            id="refresh-products-btn"
            className="btn btn-secondary"
            onClick={loadProducts}
            disabled={loading}
            title="Refresh product list from database"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
          >
            ↻ Refresh
          </button>

          {canCreate ? (
            <button
              id="add-product-btn"
              className="btn"
              onClick={handleOpenModal}
              style={{
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                padding: '0.45rem 1rem',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              + Add Product
            </button>
          ) : (
            <button
              id="add-product-btn-disabled"
              className="btn btn-secondary"
              disabled
              title="Only OWNER or ADMIN can create products"
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', opacity: 0.5 }}
            >
              + Add Product
            </button>
          )}
        </div>
      </div>

      {/* Success Toast Notice */}
      {successToast && (
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
          <span>{successToast}</span>
        </div>
      )}

      {/* Error State */}
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
            onClick={loadProducts}
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

      {/* Search & Category Filter Controls */}
      {products.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <input
            id="product-search-input"
            type="text"
            placeholder="Search by name, SKU, or category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 240px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />

          {existingCategories.length > 0 && (
            <select
              id="product-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.5rem 0.85rem',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Categories ({products.length})</option>
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {(searchQuery || selectedCategory !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.9rem' }}>Loading product catalog…</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && !error && (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            border: '1px dashed var(--border-color)',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.6 }}>📦</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            No Products Registered
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            Your business does not have any catalog items yet. Create your first product SKU to start tracking stock,
            calculating sales velocity, and generating AI insights.
          </p>
          {canCreate ? (
            <button
              id="empty-add-product-btn"
              className="btn"
              onClick={handleOpenModal}
              style={{
                background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))',
                fontSize: '0.85rem',
              }}
            >
              + Create First Product
            </button>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ask your business Owner or Administrator to add products.
            </p>
          )}
        </div>
      )}

      {/* No Filter Results */}
      {!loading && products.length > 0 && filteredProducts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '0.875rem' }}>No products match your current search or filter criteria.</p>
        </div>
      )}

      {/* Products Table */}
      {filteredProducts.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            id="products-table"
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
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <th style={{ padding: '0.65rem 0.75rem' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Product Name</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Category</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Stock On Hand</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Reorder At</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const qty = p.inventory?.quantity ?? 0;
                const reorder = p.inventory?.reorder_level ?? 10;
                const isOutOfStock = qty === 0;
                const isLowStock = !isOutOfStock && qty <= reorder;

                let stockColor = 'var(--status-success)';
                let stockBg = 'rgba(16, 185, 129, 0.1)';
                let stockLabel = `${qty} units`;

                if (isOutOfStock) {
                  stockColor = 'var(--status-error)';
                  stockBg = 'rgba(239, 68, 68, 0.12)';
                  stockLabel = '0 (Stockout)';
                } else if (isLowStock) {
                  stockColor = 'var(--status-pending)';
                  stockBg = 'rgba(245, 158, 11, 0.12)';
                  stockLabel = `${qty} (Low)`;
                }

                return (
                  <tr
                    key={p.id}
                    id={`product-row-${p.id}`}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s ease',
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
                        {p.sku}
                      </span>
                    </td>

                    {/* Name */}
                    <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {p.name}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                        }}
                      >
                        {p.category}
                      </span>
                    </td>

                    {/* Unit Price */}
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      ${p.unit_price.toFixed(2)}
                    </td>

                    {/* Stock On Hand */}
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: stockColor,
                          background: stockBg,
                          border: `1px solid ${stockColor}40`,
                          padding: '2px 8px',
                          borderRadius: '100px',
                          display: 'inline-block',
                          minWidth: '70px',
                        }}
                      >
                        {stockLabel}
                      </span>
                    </td>

                    {/* Reorder Level */}
                    <td
                      style={{
                        padding: '0.75rem',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {reorder}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Create Product Modal ─── */}
      {isModalOpen && (
        <div className="auth-modal-overlay" onClick={handleCloseModal}>
          <div
            className="auth-modal"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Register New Product SKU
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Creates catalog entry and initializes 1-to-1 inventory tracking in SQLite.
                </p>
              </div>
              <button
                id="close-modal-btn"
                onClick={handleCloseModal}
                disabled={formSubmitting}
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

            {/* Error in form */}
            {formError && (
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
                ⚠ {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              {/* Product Name */}
              <div className="auth-field">
                <label htmlFor="prod-name">Product Name *</label>
                <input
                  id="prod-name"
                  type="text"
                  placeholder="e.g. Colombian Espresso Roast"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={formSubmitting}
                  maxLength={255}
                  required
                />
              </div>

              {/* SKU & Price in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="auth-field">
                  <label htmlFor="prod-sku">SKU Code *</label>
                  <input
                    id="prod-sku"
                    type="text"
                    placeholder="e.g. COF-001"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value.toUpperCase())}
                    disabled={formSubmitting}
                    maxLength={100}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="prod-price">Unit Price ($) *</label>
                  <input
                    id="prod-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    disabled={formSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Category */}
              <div className="auth-field">
                <label htmlFor="prod-category">Category *</label>
                <input
                  id="prod-category"
                  type="text"
                  placeholder="e.g. Beverages"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  disabled={formSubmitting}
                  maxLength={100}
                  required
                />
                {/* Category preset chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {PRESET_CATEGORIES.slice(0, 5).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      disabled={formSubmitting}
                      style={{
                        background: formCategory === cat ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        border: formCategory === cat ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        color: formCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Inventory & Reorder Level in 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="auth-field">
                  <label htmlFor="prod-quantity">Initial Stock Count</label>
                  <input
                    id="prod-quantity"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                    disabled={formSubmitting}
                  />
                  <span className="auth-field-hint">Units currently on hand</span>
                </div>

                <div className="auth-field">
                  <label htmlFor="prod-reorder">Reorder Threshold</label>
                  <input
                    id="prod-reorder"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="10"
                    value={formReorderLevel}
                    onChange={(e) => setFormReorderLevel(e.target.value)}
                    disabled={formSubmitting}
                  />
                  <span className="auth-field-hint">Triggers low-stock alert</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={formSubmitting}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  id="submit-create-product-btn"
                  type="submit"
                  className="auth-submit-btn"
                  disabled={formSubmitting}
                  style={{ flex: 2, margin: 0 }}
                >
                  {formSubmitting ? 'Registering SKU…' : 'Register Product SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
