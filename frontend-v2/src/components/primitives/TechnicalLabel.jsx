import React from 'react'

export default function TechnicalLabel({
  prefix,
  value,
  variant = 'default', // 'default' | 'cyan' | 'brand' | 'purple' | 'risk' | 'success'
  size = 'sm', // 'xs' | 'sm' | 'md'
  copyable = false,
  className = '',
  style = {},
}) {
  const [copied, setCopied] = React.useState(false)

  const variantStyles = {
    default: {
      background: 'rgba(255, 255, 255, 0.05)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)',
    },
    cyan: {
      background: 'rgba(6, 182, 212, 0.1)',
      color: 'var(--cyan)',
      border: '1px solid rgba(6, 182, 212, 0.25)',
    },
    brand: {
      background: 'rgba(59, 130, 246, 0.1)',
      color: 'var(--brand-light)',
      border: '1px solid rgba(59, 130, 246, 0.25)',
    },
    purple: {
      background: 'rgba(168, 85, 247, 0.1)',
      color: 'var(--purple)',
      border: '1px solid rgba(168, 85, 247, 0.25)',
    },
    risk: {
      background: 'rgba(244, 63, 94, 0.1)',
      color: 'var(--risk-light)',
      border: '1px solid rgba(244, 63, 94, 0.25)',
    },
    success: {
      background: 'rgba(16, 185, 129, 0.1)',
      color: 'var(--resolved-light)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
    },
  }

  const sizeStyles = {
    xs: { fontSize: 9.5, padding: '1px 5px' },
    sm: { fontSize: 11, padding: '2px 7px' },
    md: { fontSize: 12, padding: '3px 9px' },
  }

  const handleCopy = () => {
    if (!copyable || !value) return
    navigator.clipboard.writeText(String(value))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const selected = variantStyles[variant] || variantStyles.default
  const currentSize = sizeStyles[size] || sizeStyles.sm

  return (
    <span
      className={`nexus-tech-label mono ${copyable ? 'copyable' : ''} ${className}`}
      onClick={handleCopy}
      title={copyable ? (copied ? 'Copied!' : 'Click to copy') : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 'var(--radius-xs)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        cursor: copyable ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        ...selected,
        ...currentSize,
        ...style,
      }}
    >
      {prefix && (
        <span style={{ opacity: 0.65, fontWeight: 500, marginRight: 1 }}>{prefix}:</span>
      )}
      <span>{value}</span>
      {copied && (
        <span style={{ fontSize: 9, color: 'var(--resolved-light)', fontWeight: 700 }}>✓</span>
      )}
    </span>
  )
}
