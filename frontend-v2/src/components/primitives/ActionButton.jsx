import React from 'react'
import { Loader2 } from 'lucide-react'

export default function ActionButton({
  children,
  onClick,
  variant = 'primary', // 'primary' | 'danger' | 'ghost' | 'subtle' | 'outline' | 'cyan'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  style = {},
  ...props
}) {
  const variantStyles = {
    primary: {
      background: 'var(--brand)',
      color: '#fff',
      border: '1px solid rgba(59, 130, 246, 0.4)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2), 0 0 12px rgba(59, 130, 246, 0.2)',
    },
    cyan: {
      background: 'rgba(6, 182, 212, 0.15)',
      color: 'var(--cyan)',
      border: '1px solid rgba(6, 182, 212, 0.4)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2), 0 0 12px rgba(6, 182, 212, 0.2)',
    },
    danger: {
      background: 'rgba(244, 63, 94, 0.15)',
      color: 'var(--risk-light)',
      border: '1px solid rgba(244, 63, 94, 0.35)',
      boxShadow: '0 0 10px rgba(244, 63, 94, 0.15)',
    },
    subtle: {
      background: 'rgba(255, 255, 255, 0.05)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-default)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid transparent',
    },
  }

  const sizeStyles = {
    sm: { padding: '5px 10px', fontSize: 11.5, gap: 5 },
    md: { padding: '7px 14px', fontSize: 12.5, gap: 6 },
    lg: { padding: '10px 18px', fontSize: 14, gap: 8 },
  }

  const currentVariant = variantStyles[variant] || variantStyles.primary
  const currentSize = sizeStyles[size] || sizeStyles.md

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`nexus-action-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        borderRadius: 'var(--radius-xs)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        ...currentVariant,
        ...currentSize,
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <Loader2 size={13} style={{ animation: 'nexusSpin 1s linear infinite' }} />
      ) : (
        Icon && <Icon size={14} />
      )}
      <span>{children}</span>
    </button>
  )
}
