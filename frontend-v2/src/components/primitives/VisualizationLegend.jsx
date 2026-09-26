import React from 'react'

export default function VisualizationLegend({
  items = [], // Array of { label, color, type: 'dot' | 'line' | 'bar', count }
  className = '',
  style = {},
}) {
  return (
    <div
      className={`nexus-vis-legend ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        fontSize: 11,
        color: 'var(--text-secondary)',
        ...style,
      }}
    >
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {item.type === 'line' ? (
            <span
              style={{
                width: 12,
                height: 2,
                backgroundColor: item.color,
                display: 'inline-block',
                borderRadius: 1,
              }}
            />
          ) : item.type === 'bar' ? (
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: item.color,
                display: 'inline-block',
                borderRadius: 2,
              }}
            />
          ) : (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: item.color,
                display: 'inline-block',
              }}
            />
          )}
          <span>{item.label}</span>
          {item.count !== undefined && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              ({item.count})
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
