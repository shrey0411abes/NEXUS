import React from 'react'
import {
  Inbox,
  AlertTriangle,
  WifiOff,
  AlertCircle,
  RotateCw,
  SearchX,
  FileQuestion,
} from 'lucide-react'

/**
 * Enterprise state component distinguishing:
 * - 'empty': Authentic zero-record state (e.g. no transactions recorded)
 * - 'unavailable': Telemetry not configured or temporarily unavailable
 * - 'error': Query/network rejection
 * - 'degraded': Partial system availability
 * - 'no-match': Search or filter resulted in zero matches
 */
export default function EmptyState({
  variant = 'empty', // 'empty' | 'unavailable' | 'error' | 'degraded' | 'no-match'
  title,
  description,
  actionText,
  onAction,
  icon: CustomIcon,
  minHeight = 220,
}) {
  const configs = {
    empty: {
      icon: Inbox,
      title: title || 'No Records Found',
      desc: description || 'No verified telemetry records exist for the selected criteria.',
      borderClass: '',
      color: 'var(--text-muted)',
    },
    unavailable: {
      icon: WifiOff,
      title: title || 'Telemetry Unavailable',
      desc: description || 'Operational telemetry feed is currently unreachable.',
      borderClass: 'degraded',
      color: 'var(--ack-light)',
    },
    error: {
      icon: AlertCircle,
      title: title || 'Data Retrieval Error',
      desc: description || 'Unable to retrieve verified data from the backend database.',
      borderClass: 'error',
      color: 'var(--risk-light)',
    },
    degraded: {
      icon: AlertTriangle,
      title: title || 'Operating in Degraded Mode',
      desc: description || 'Some analytical pipelines are temporarily experiencing delayed telemetry.',
      borderClass: 'degraded',
      color: 'var(--ack-light)',
    },
    'no-match': {
      icon: SearchX,
      title: title || 'No Matching Results',
      desc: description || 'Adjust your search terms or filter criteria to see matching items.',
      borderClass: '',
      color: 'var(--text-muted)',
    },
  }

  const current = configs[variant] || configs.empty
  const IconComponent = CustomIcon || current.icon

  return (
    <div
      className={`state-box ${current.borderClass}`}
      style={{
        minHeight,
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: current.color,
          marginBottom: 4,
        }}
      >
        <IconComponent size={22} />
      </div>

      <div style={{ maxWidth: 440 }}>
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
            letterSpacing: '-0.01em',
          }}
        >
          {current.title}
        </h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {current.desc}
        </p>
      </div>

      {actionText && onAction && (
        <button
          type="button"
          className="btn-retry"
          onClick={onAction}
          style={{ marginTop: 8 }}
        >
          <RotateCw size={12} />
          <span>{actionText}</span>
        </button>
      )}
    </div>
  )
}
