/**
 * A sparkline for a KPI card.
 *
 * Server-rendered inline SVG — no client component, no chart library. A KPI
 * sparkline is decorative context: the figure it annotates is already in the
 * DOM, so this is `aria-hidden` and inherits its colour from the parent
 * (`currentColor`) rather than hard-coding a series colour.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  className = '',
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  // Two points are the minimum that can describe a trend.
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const pad = 2
  const usable = height - pad * 2
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => {
    // A flat series has no span to normalise against. Draw it down the middle
    // instead of dividing by zero.
    const ratio = span === 0 ? 0.5 : (v - min) / span
    return [i * stepX, pad + (1 - ratio) * usable] as const
  })

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <polygon points={area} className="fill-current opacity-10" />
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="stroke-current"
      />
    </svg>
  )
}
