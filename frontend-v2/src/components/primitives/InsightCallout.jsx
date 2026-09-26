import React from 'react'
import { ShieldCheck, Sparkles, AlertTriangle, Info } from 'lucide-react'
import VerifiedBadge from './VerifiedBadge.jsx'
import IntelligenceBadge from './IntelligenceBadge.jsx'

export default function InsightCallout({
  type = 'verified', // 'verified' | 'ai' | 'action' | 'degraded' | 'info'
  title,
  children,
  action,
  className = '',
  style = {},
}) {
  const configs = {
    verified: {
      badge: <VerifiedBadge />,
      icon: ShieldCheck,
      color: 'var(--cyan)',
      bg: 'rgba(6, 182, 212, 0.05)',
      border: 'rgba(6, 182, 212, 0.25)',
    },
    ai: {
      badge: <IntelligenceBadge />,
      icon: Sparkles,
      color: 'var(--purple)',
      bg: 'rgba(168, 85, 247, 0.05)',
      border: 'rgba(168, 85, 247, 0.25)',
    },
    action: {
      badge: (
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(244, 63, 94, 0.15)',
            color: 'var(--risk-light)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
          }}
        >
          ACTION REQUIRED
        </span>
      ),
      icon: AlertTriangle,
      color: 'var(--risk-light)',
      bg: 'rgba(244, 63, 94, 0.05)',
      border: 'rgba(244, 63, 94, 0.25)',
    },
    degraded: {
      badge: (
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--radius-xs)',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          DEGRADED DATA
        </span>
      ),
      icon: AlertTriangle,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.25)',
    },
    info: {
      badge: null,
      icon: Info,
      color: 'var(--brand-light)',
      bg: 'rgba(59, 130, 246, 0.05)',
      border: 'rgba(59, 130, 246, 0.25)',
    },
  }

  const current = configs[type] || configs.verified
  const Icon = current.icon

  return (
    <div
      className={`nexus-insight-callout ${className}`}
      style={{
        background: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: 'var(--radius-sm)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={16} style={{ color: current.color, flexShrink: 0 }} />
          {title && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </span>
          )}
        </div>
        {current.badge}
      </div>

      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {children}
      </div>

      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
