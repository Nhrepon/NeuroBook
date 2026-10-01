import { formatTakaCompact, formatTakaFromMinor } from '@/shared/format'

/**
 * A ৳ amount, always with tabular figures so digits line up column-wise.
 *
 * The compact form ("৳ 1.23 Cr") is what a KPI card shows, but an abbreviation
 * is meaningless to a screen reader and useless when copied. So in compact mode
 * the exact value ships in a visually-hidden span and the abbreviation is
 * `aria-hidden`: assistive tech announces "৳ 1,23,456.78" while the eye reads
 * "৳ 1.23 Cr", and both are in the DOM.
 */
export function Money({
  minor,
  compact = false,
  className = '',
}: {
  minor: number | null
  compact?: boolean
  className?: string
}) {
  if (minor === null) {
    return (
      <span className={`tabular-nums text-muted-foreground ${className}`} title="Not available">
        —
      </span>
    )
  }

  const exact = formatTakaFromMinor(minor)
  if (!compact) {
    return <span className={`tabular-nums ${className}`}>{exact}</span>
  }

  return (
    <span className={`tabular-nums ${className}`} title={exact}>
      <span aria-hidden="true">{formatTakaCompact(minor)}</span>
      <span className="sr-only">{exact}</span>
    </span>
  )
}
