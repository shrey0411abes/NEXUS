import React from 'react'

export default function StatusIndicator({
  status = 'active', // 'active' | 'verified' | 'ai' | 'warning' | 'critical' | 'degraded' | 'archived' | 'neutral'
  label,
  pulse = false,
  size = 'sm', // 'xs' | 'sm' | 'md'
  className = '',
  style = {},
}) {
  const configs = {
    active: {
      color: 'var(--resolved-light)',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)',
      dot: '#10b981',
      defaultLabel: 'ACTIVE',
    },
    verified: {
      color: '#06b6d4',
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
      dot: '#06b6d4',
      defaultLabel: 'VERIFIED FACT',
    },
    ai: {
      color: '#c084fc',
      bg: 'rgba(168, 85, 247, 0.12)',
      border: 'rgba(168, 85, 247, 0.3)',
      dot: '#a855f7',
      defaultLabel: 'AI INTERPRETATION',
    },
    warning: {
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      dot: '#f59e0b',
      defaultLabel: 'ATTENTION',
    },
    critical: {
      color: '#f43f5e',
      bg: 'rgba(244, 63, 94, 0.14)',
      border: 'rgba(244, 63, 94, 0.35)',
      dot: '#f43f5e',
      defaultLabel: 'CRITICAL RISK',
    },
    degraded: {
      color: '#fb923c',
      bg: 'rgba(251, 146, 60, 0.12)',
      border: 'rgba(251, 146, 60, 0.3)',
      dot: '#fb923c',
      defaultLabel: 'DEGRADED',
    },
    archived: {
      color: 'var(--text-muted)',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      dot: '#64748b',
      defaultLabel: 'ARCHIVED',
    },
    neutral: {
      color: 'var(--text-secondary)',
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'var(--border-subtle)',
      dot: '#94a3b8',
      defaultLabel: 'TELEMETRY',
    },
  }

  const current = configs[status] || configs.neutral
  const text = label || current.defaultLabel

  const sizes = {
    xs: { fontSize: 9.5, padding: '1px 6px', dotSize: 5 },
    sm: { fontSize: 10.5, padding: '2px 8px', dotSize: 6 },
    md: { fontSize: 11.5, padding: '3px 10px', dotSize: 7 },
  }
  const currentSize = sizes[size] || sizes.sm

  return (
    <span
      className={`nexus-status-indicator mono ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        borderRadius: 'var(--radius-xs)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: current.bg,
        color: current.color,
        border: `1px solid ${current.border}`,
        ...currentSize,
        ...style,
      }}
    >
      <span
        style={{
          width: currentSize.dotSize,
          height: currentSize.dotSize,
          borderRadius: '50%',
          backgroundColor: current.dot,
          boxShadow: pulse ? `0 0 6px ${current.dot}` : 'none',
          animation: pulse ? 'nexusPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none',
        }}
      />
      <span>{text}</span>
    </span>
  )
}
