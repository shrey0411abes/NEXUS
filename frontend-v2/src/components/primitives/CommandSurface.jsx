import React from 'react'
import { Search, Filter, X } from 'lucide-react'

export default function CommandSurface({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Filter operational records...',
  filters = [], // Array of { id, label, active, onClick, count }
  actions,
  metadata,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`nexus-command-surface ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: 16,
        ...style,
      }}
    >
      {/* Search & Active Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
        {onSearchChange && (
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              maxWidth: 360,
              minWidth: 180,
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                padding: '6px 12px 6px 32px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: 12.5,
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--cyan)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-subtle)')}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Filter Pills */}
        {filters.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={filter.onClick}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: filter.active
                    ? '1px solid rgba(6, 182, 212, 0.4)'
                    : '1px solid var(--border-subtle)',
                  background: filter.active ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  color: filter.active ? 'var(--cyan)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{filter.label}</span>
                {filter.count !== undefined && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      padding: '0 4px',
                      borderRadius: 3,
                      background: filter.active ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      color: filter.active ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls: Actions & Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {metadata && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {metadata}
          </div>
        )}
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
      </div>
    </div>
  )
}
