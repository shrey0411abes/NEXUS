import React from 'react'

export function Skeleton({ width = '100%', height = 20, borderRadius = 'var(--radius-xs)', style = {} }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

export function CardSkeleton({ height = 120 }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="18px" height={18} borderRadius="50%" />
      </div>
      <div>
        <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
        <Skeleton width="30%" height={12} />
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = 260, title }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px',
        height,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="35%" height={16} />
        <Skeleton width="20%" height={14} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 12, paddingBottom: 10 }}>
        <Skeleton width="12%" height="45%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="70%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="55%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="90%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="60%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="75%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="40%" borderRadius="var(--radius-xs)" />
        <Skeleton width="12%" height="85%" borderRadius="var(--radius-xs)" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-${i}`} height={14} width="70%" />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`row-${r}`}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 16,
              alignItems: 'center',
            }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`cell-${r}-${c}`} height={16} width={c === 0 ? '85%' : '60%'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageSuspenseFallback() {
  return (
    <div
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        maxWidth: 1680,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 320 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="100%" height={28} />
          <Skeleton width="80%" height={14} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Skeleton width={110} height={36} borderRadius="var(--radius-xs)" />
          <Skeleton width={130} height={36} borderRadius="var(--radius-xs)" />
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 20,
        }}
      >
        <ChartSkeleton height={300} />
        <ChartSkeleton height={300} />
      </div>
    </div>
  )
}

export default Skeleton
