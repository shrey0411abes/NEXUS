import React from 'react'
import Sparkline from './Sparkline.jsx'

export default function Metric({
  label,
  value,
  unit,
  change, // e.g. "+12.4%" or "-5.2%"
  changeDirection = 'neutral', // 'positive' | 'negative' | 'neutral'
  changeLabel, // e.g. "vs last 7d"
  sparklineData,
  sparklineColor,
  verified = false,
  ai = false,
  statusDot, // e.g. '#10b981'
  icon: Icon,
  onClick,
  className = '',
  style = {},
}) {
  const getChangeColor = () => {
    if (changeDirection === 'positive') return 'var(--resolved-light)'
    if (changeDirection === 'negative') return 'var(--risk-light)'
    return 'var(--text-muted)'
  }

  return (
    <div
      className={`nexus-metric-card ${onClick ? 'interactive' : ''} ${className}`}
      onClick={onClick}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s ease, transform 0.15s ease, background 0.15s ease',
        ...style,
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {statusDot && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: statusDot,
                display: 'inline-block',
              }}
            />
          )}
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {verified && (
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(6, 182, 212, 0.12)',
                color: 'var(--cyan)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
              }}
            >
              VERIFIED
            </span>
          )}
          {ai && (
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
                background: 'rgba(168, 85, 247, 0.12)',
                color: 'var(--purple)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
              }}
            >
              AI EXPLAINED
            </span>
          )}
          {Icon && (
            <span style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
              <Icon size={14} />
            </span>
          )}
        </div>
      </div>

      {/* Main Metric Value & Sparkline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginTop: 14,
          marginBottom: 6,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span
            className="mono cell-mono"
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {value !== undefined && value !== null ? value : '—'}
          </span>
          {unit && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              {unit}
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div style={{ flexShrink: 0 }}>
            <Sparkline
              data={sparklineData}
              width={90}
              height={28}
              color={sparklineColor || (changeDirection === 'negative' ? 'var(--risk-light)' : 'var(--cyan)')}
            />
          </div>
        )}
      </div>

      {/* Bottom Sub-context */}
      {(change || changeLabel) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 4 }}>
          {change && (
            <span
              className="mono"
              style={{
                fontWeight: 600,
                color: getChangeColor(),
              }}
            >
              {change}
            </span>
          )}
          {changeLabel && (
            <span style={{ color: 'var(--text-muted)' }}>
              {changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
