import React from 'react'

export default function MetricDisplay({
  label,
  value,
  unit,
  context,
  tone = 'default', // 'default' | 'brand' | 'risk' | 'ack' | 'resolved' | 'cyan' | 'purple'
  badge,
  icon: Icon,
  onClick,
  style = {},
}) {
  const toneMap = {
    default: { color: '#fff', glow: 'transparent' },
    brand: { color: 'var(--brand-light)', glow: 'var(--brand-glow)' },
    risk: { color: 'var(--risk-light)', glow: 'var(--risk-glow)' },
    ack: { color: 'var(--ack-light)', glow: 'var(--ack-glow)' },
    resolved: { color: 'var(--resolved-light)', glow: 'var(--resolved-glow)' },
    cyan: { color: 'var(--cyan)', glow: 'var(--cyan-glow)' },
    purple: { color: 'var(--purple)', glow: 'var(--purple-glow)' },
  }

  const selectedTone = toneMap[tone] || toneMap.default

  return (
    <div
      className={`pulse-kpi-item ${onClick ? 'interactive' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && (
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {badge}
            </span>
          )}
          {Icon && (
            <span style={{ color: selectedTone.color, opacity: 0.85, display: 'inline-flex' }}>
              <Icon size={14} />
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span
            className="mono cell-mono"
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: selectedTone.color,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {value !== undefined && value !== null ? value : '—'}
          </span>
          {unit && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
              {unit}
            </span>
          )}
        </div>
      </div>

      {context && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.3,
            marginTop: 4,
          }}
        >
          {context}
        </span>
      )}
    </div>
  )
}
