import React from 'react'

export default function CustomChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (val) => val,
  contextLabel = null,
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="custom-chart-tooltip">
      {label && <div className="tooltip-title">{label}</div>}
      {payload.map((entry, index) => (
        <div key={`item-${index}`} style={{ margin: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: entry.color || 'var(--brand)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {entry.name}:
            </span>
            <span className="tooltip-value" style={{ fontSize: 13, marginLeft: 'auto' }}>
              {valueFormatter(entry.value, entry.name)}
            </span>
          </div>
        </div>
      ))}
      {contextLabel && <div className="tooltip-sub">{contextLabel}</div>}
    </div>
  )
}
