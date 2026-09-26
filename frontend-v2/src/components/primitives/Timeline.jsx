import React from 'react'

export default function Timeline({
  items = [], // Array of { id, time, title, description, badge, actor, status: 'verified' | 'action' | 'risk' | 'neutral', meta }
  className = '',
  emptyText = 'No chronological events recorded.',
}) {
  if (!items || items.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        {emptyText}
      </div>
    )
  }

  const statusColors = {
    verified: '#06b6d4',
    action: '#10b981',
    risk: '#f43f5e',
    ai: '#a855f7',
    neutral: '#64748b',
  }

  return (
    <div className={`nexus-technical-timeline ${className}`} style={{ position: 'relative', paddingLeft: 20 }}>
      {/* Vertical line connecting nodes */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          left: 6,
          width: 2,
          background: 'var(--border-subtle)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {items.map((item, idx) => {
          const dotColor = statusColors[item.status] || statusColors.neutral

          return (
            <div key={item.id ?? idx} style={{ position: 'relative' }}>
              {/* Node Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -20,
                  top: 4,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'var(--bg-deep)',
                  border: `2px solid ${dotColor}`,
                  boxShadow: `0 0 8px ${dotColor}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: dotColor }} />
              </div>

              {/* Event Content */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.title}
                    </span>
                    {item.badge}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {item.time}
                  </div>
                </div>

                {item.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, margin: '4px 0 0 0' }}>
                    {item.description}
                  </p>
                )}

                {(item.actor || item.meta) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.actor && <span>By: <span style={{ color: 'var(--text-primary)' }}>{item.actor}</span></span>}
                    {item.meta && <span className="mono" style={{ fontSize: 10.5 }}>{item.meta}</span>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
