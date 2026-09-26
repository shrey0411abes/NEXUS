import React from 'react'
import { ResponsiveContainer } from 'recharts'
import VerifiedBadge from './VerifiedBadge.jsx'
import IntelligenceBadge from './IntelligenceBadge.jsx'

export default function ChartContainer({
  title,
  subtitle,
  badgeType = 'verified', // 'verified' | 'ai' | 'none'
  legend,
  actions,
  height = 260,
  minHeight = 200,
  children,
  className = '',
  style = {},
}) {
  return (
    <div
      className={`nexus-chart-container ${className}`}
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              {title}
            </h3>
            {badgeType === 'verified' && <VerifiedBadge />}
            {badgeType === 'ai' && <IntelligenceBadge />}
          </div>
          {subtitle && (
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {subtitle}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {legend}
          {actions}
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ width: '100%', height, minHeight, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
