import React from 'react'

export default function GlassPanel({
  children,
  className = '',
  intensity = 'medium', // 'low' | 'medium' | 'high'
  borderGlow = 'none', // 'none' | 'cyan' | 'brand' | 'purple' | 'risk'
  style = {},
  ...props
}) {
  const intensityMap = {
    low: 'rgba(16, 21, 30, 0.45)',
    medium: 'rgba(15, 23, 42, 0.65)',
    high: 'rgba(10, 15, 26, 0.85)',
  }

  const borderMap = {
    none: '1px solid var(--border-subtle)',
    cyan: '1px solid rgba(6, 182, 212, 0.35)',
    brand: '1px solid rgba(59, 130, 246, 0.35)',
    purple: '1px solid rgba(168, 85, 247, 0.35)',
    risk: '1px solid rgba(244, 63, 94, 0.35)',
  }

  return (
    <div
      className={`nexus-glass-panel ${className}`}
      style={{
        background: intensityMap[intensity] || intensityMap.medium,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: borderMap[borderGlow] || borderMap.none,
        borderRadius: 'var(--radius-md)',
        boxShadow:
          borderGlow !== 'none'
            ? `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 16px 0 ${borderMap[borderGlow].split(' ')[2]}`
            : '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
