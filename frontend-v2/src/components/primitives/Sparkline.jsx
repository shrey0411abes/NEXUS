import React from 'react'

export default function Sparkline({
  data = [],
  width = 120,
  height = 32,
  color = 'var(--cyan)',
  fillColor,
  strokeWidth = 1.8,
  showDot = true,
  className = '',
}) {
  if (!data || data.length < 2) {
    return (
      <div
        className={`nexus-sparkline-empty ${className}`}
        style={{ width, height, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>—</span>
      </div>
    )
  }

  const values = data.map((d) => (typeof d === 'number' ? d : Number(d.value ?? d.y ?? 0)))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min === 0 ? 1 : max - min

  const padding = 3
  const effW = width - padding * 2
  const effH = height - padding * 2

  const points = values.map((val, idx) => {
    const x = padding + (idx / (values.length - 1)) * effW
    const y = height - padding - ((val - min) / range) * effH
    return { x, y, val }
  })

  const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '')
  const lastPoint = points[points.length - 1]

  const areaD = `${pathD} L ${lastPoint.x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`
  const fillGradientId = `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`

  return (
    <svg
      width={width}
      height={height}
      className={`nexus-sparkline ${className}`}
      style={{ overflow: 'visible', verticalAlign: 'middle' }}
    >
      <defs>
        <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor || color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={fillColor || color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillGradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill={color}
          stroke="var(--bg-deep)"
          strokeWidth={1}
        />
      )}
    </svg>
  )
}
