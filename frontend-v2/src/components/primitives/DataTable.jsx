import React from 'react'
import EmptyState from '../EmptyState.jsx'
import Skeleton from '../Skeleton.jsx'

export default function DataTable({
  columns = [], // Array of { key, header, render, width, align, mono }
  data = [],
  rowKey = (row, idx) => row.id ?? idx,
  onRowClick,
  selectedKey,
  loading = false,
  emptyTitle,
  emptyDescription,
  renderMobileCard,
  className = '',
  style = {},
}) {
  if (loading) {
    return (
      <div style={{ padding: '24px 16px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-sm)' }}>
        <Skeleton variant="table-row" count={5} />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle || 'No Records Found'}
        description={emptyDescription || 'No operational records match the current view.'}
      />
    )
  }

  return (
    <div className={`nexus-datatable-wrapper ${className}`} style={style}>
      {/* Desktop / Tablet Table View */}
      <div
        className="nexus-datatable-container desktop-table-view"
        style={{
          overflowX: 'auto',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <table
          className="nexus-data-table"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: 12.5,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    textAlign: col.align || 'left',
                    width: col.width || 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const key = rowKey(row, idx)
              const isSelected = selectedKey != null && selectedKey === key

              return (
                <tr
                  key={key}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`nexus-table-row ${onRowClick ? 'interactive' : ''} ${
                    isSelected ? 'selected' : ''
                  }`}
                  style={{
                    borderBottom:
                      idx === data.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    background: isSelected
                      ? 'rgba(6, 182, 212, 0.08)'
                      : idx % 2 === 1
                      ? 'rgba(255, 255, 255, 0.012)'
                      : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '12px 14px',
                        color: 'var(--text-primary)',
                        textAlign: col.align || 'left',
                        whiteSpace: col.wrap ? 'normal' : 'nowrap',
                      }}
                      className={col.mono ? 'mono cell-mono' : ''}
                    >
                      {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Presentation (Visible on Viewports <= 768px) */}
      <div className="mobile-table-cards">
        {data.map((row, idx) => {
          const key = rowKey(row, idx)
          const isSelected = selectedKey != null && selectedKey === key

          if (renderMobileCard) {
            return (
              <div
                key={key}
                onClick={() => onRowClick && onRowClick(row)}
                className={`nexus-mobile-card-item ${onRowClick ? 'interactive' : ''} ${isSelected ? 'selected' : ''}`}
              >
                {renderMobileCard(row, idx)}
              </div>
            )
          }

          return (
            <div
              key={key}
              onClick={() => onRowClick && onRowClick(row)}
              className={`nexus-mobile-card-item ${onRowClick ? 'interactive' : ''} ${isSelected ? 'selected' : ''}`}
            >
              <div className="nexus-mobile-card-header">
                <span className="nexus-mobile-card-title">
                  {columns[0]?.render ? columns[0].render(row[columns[0].key], row, idx) : row[columns[0]?.key]}
                </span>
                {columns.length > 1 && (
                  <span className="nexus-mobile-card-badge">
                    {columns[columns.length - 1]?.render
                      ? columns[columns.length - 1].render(row[columns[columns.length - 1].key], row, idx)
                      : row[columns[columns.length - 1]?.key]}
                  </span>
                )}
              </div>
              <div className="nexus-mobile-card-fields">
                {columns.slice(1, Math.min(columns.length - 1, 4)).map((col) => (
                  <div key={col.key} className="nexus-mobile-card-field">
                    <span className="nexus-mobile-card-field-label">{col.header}</span>
                    <span className="nexus-mobile-card-field-val">
                      {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
