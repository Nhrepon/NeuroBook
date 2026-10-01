// Lakh/crore grouping via en-IN. Dates dd/mm/yy. Taka symbol ৳.

const numberFmt = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const numberFmtWithPaisa = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})

/** Format a major-unit number with lakh/crore grouping. */
export function formatLakhCrore(value: number, withPaisa = false): string {
  return (withPaisa ? numberFmtWithPaisa : numberFmt).format(value)
}

/** Format a minor-unit amount (taka × 100) as ৳ with lakh/crore grouping. */
export function formatTakaFromMinor(minor: number): string {
  const major = minor / 100
  return `৳ ${formatLakhCrore(major, true)}`
}

/** Format a major-unit amount as ৳ with lakh/crore grouping. */
export function formatTaka(major: number): string {
  return `৳ ${formatLakhCrore(major, true)}`
}

/** Format a date as dd/mm/yy. */
export function formatDateBd(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return dateFmt.format(d)
}

/**
 * Compact ৳ for dashboards and axes: ৳ 12.30 K / ৳ 4.56 L / ৳ 1.23 Cr.
 * BD readers think in lakh and crore, so a KPI card never shows eight digits.
 * The exact figure belongs in the card's title and in the drill-through.
 */
export function formatTakaCompact(minor: number): string {
  const major = Math.abs(minor) / 100
  const sign = minor < 0 ? '-' : ''
  if (major >= 1e7) return `${sign}৳ ${(major / 1e7).toFixed(2)} Cr`
  if (major >= 1e5) return `${sign}৳ ${(major / 1e5).toFixed(2)} L`
  if (major >= 1e3) return `${sign}৳ ${(major / 1e3).toFixed(2)} K`
  return `${sign}৳ ${formatLakhCrore(major, true)}`
}

/**
 * Percentage change between two minor-unit figures.
 * `null` when there is no baseline — 0 → anything is undefined, not infinite.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return Number.isFinite(pct) ? pct : null
}

/** Render a delta for display. Never emits NaN, Infinity, or a bare '-0'. */
export function formatDelta(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—'
  const rounded = Math.abs(pct) >= 100 ? Math.round(pct) : Math.round(pct * 10) / 10
  if (rounded === 0) return '0%'
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

/** NBR fiscal year (1 July – 30 June). */
export interface FiscalYear {
  start: Date
  end: Date
  label: string          // e.g. "FY 2025-26"
}

export function currentFiscalYear(now: Date = new Date()): FiscalYear {
  const y = now.getFullYear()
  const m = now.getMonth() // 0-11
  const startYear = m >= 6 ? y : y - 1  // July (6) is start
  const start = new Date(Date.UTC(startYear, 6, 1))
  const end = new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59))
  return {
    start,
    end,
    label: `FY ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}
