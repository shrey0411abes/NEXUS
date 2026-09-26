import React from 'react'

export default function CustomChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (val) => val,
  contextLabel = null,
  explanation = null,
  showVerified = true,
}) {
  if (!active || !payload || !payload.length) return null

  return (
    <div
      className="custom-chart-tooltip"
      style={{
        background: 'rgba(10, 15, 26, 0.95)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 1px rgba(6, 182, 212, 0.3)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        minWidth: 170,
        maxWidth: 280,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 4,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.02em',
          }}
        >
          {label}
        </span>
        {showVerified && (
          <span
            className="mono"
            style={{
              fontSize: 8.5,
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: 2,
              background: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--cyan)',
            }}
          >
            VERIFIED
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {payload.map((entry, index) => {
          const formattedVal = valueFormatter(entry.value, entry.name, entry.payload)
          return (
            <div
              key={`item-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: entry.color || 'var(--brand)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
              </div>
              <span
                className="mono cell-mono"
                style={{
                  color: entry.color || 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                {formattedVal}
              </span>
            </div>
          )
        })}
      </div>

      {(contextLabel || explanation) && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 10.5,
            color: 'var(--text-muted)',
            lineHeight: 1.35,
          }}
        >
          {contextLabel && <div style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{contextLabel}</div>}
          {explanation && <div style={{ marginTop: 2 }}>{explanation}</div>}
        </div>
      )}
    </div>
  )
}
