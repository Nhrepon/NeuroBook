// Fiscal-period windows (U3: NBR fiscal year runs 1 July – 30 June).
//
// Pure: no I/O, no `next/*`, no `node:*`. The dashboard RSC, the /api/v1
// report handlers, and the Expo client all resolve `?period=` through this one
// function, so the same query string yields the same window — and therefore
// the same numbers — on every surface.
//
// All arithmetic is UTC. Bangladesh has a single offset and no DST, and
// vouchers are stored as `timestamptz`, so anchoring to UTC midnight keeps a
// voucher's calendar day stable regardless of the server's locale.
import { PERIOD_KEYS } from './schemas'
import type { PeriodKey } from './types'
import { formatDateBd } from './format/bd'

export interface PeriodWindow {
  /** Inclusive lower bound. */
  from: Date
  /** Exclusive upper bound — use `date >= from AND date < to` everywhere. */
  to: Date
}

export interface ResolvedPeriod {
  key: PeriodKey
  label: string
  from: Date
  to: Date
  previous: PeriodWindow & { label: string }
  /** Bucket size for any time series over this window. */
  granularity: 'day' | 'month'
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const MS_PER_DAY = 86_400_000
const DAYS_PER_30 = 30

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function addMonths(d: Date, n: number): Date {
  // Day is always 1 for the values we pass, so month overflow cannot skew it.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY)
}

function dayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** The 1 July on or before `d`. */
function fyStartYear(d: Date): number {
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1
}

function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String(startYear + 1).slice(-2)}`
}

/**
 * Quarters are anchored to the fiscal year, not the calendar year:
 * Q1 Jul–Sep, Q2 Oct–Dec, Q3 Jan–Mar, Q4 Apr–Jun.
 */
function quarterIndex(d: Date): number {
  const m = d.getUTCMonth()
  return 1 + Math.floor(((m - 6 + 12) % 12) / 3)
}

function quarterStart(d: Date): Date {
  const m = d.getUTCMonth()
  const startMonth = m >= 6 ? 6 + Math.floor((m - 6) / 3) * 3 : Math.floor(m / 3) * 3
  return new Date(Date.UTC(d.getUTCFullYear(), startMonth, 1))
}

/** Parse a 'YYYY-MM-DD' string as UTC midnight; `null` if it is not a real date. */
function parseIsoDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** A label derived from the window itself, so it cannot drift from the dates. */
function windowLabel(key: PeriodKey, from: Date, to: Date): string {
  if (key === 'fy') return fyLabel(fyStartYear(from))
  if (key === 'mtd') return `${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`
  if (key === 'qtd') return `Q${quarterIndex(from)} ${fyLabel(fyStartYear(from))}`
  // custom, and the generic fallback: show the inclusive range.
  return `${formatDateBd(from)} – ${formatDateBd(addDays(to, -1))}`
}

function withPrevious(
  key: PeriodKey,
  from: Date,
  to: Date,
  prevFrom?: Date,
): ResolvedPeriod {
  // Calendar-anchored periods step back one whole unit — the previous month,
  // quarter, or fiscal year. Rolling periods shift by an equal span instead.
  //
  // The two are not interchangeable: subtracting 365 days from a fiscal year
  // that contains a leap day lands on 30 June, one day short, so the "previous
  // FY" window would silently include a day of the year before it.
  const span = to.getTime() - from.getTime()
  const previousFrom = prevFrom ?? new Date(from.getTime() - span)
  return {
    key,
    label: windowLabel(key, from, to),
    from,
    to,
    previous: {
      from: previousFrom,
      to: from,
      label: windowLabel(key, previousFrom, from),
    },
    granularity: span > 62 * MS_PER_DAY ? 'month' : 'day',
  }
}

function isPeriodKey(value: string | undefined): value is PeriodKey {
  return value !== undefined && (PERIOD_KEYS as readonly string[]).includes(value)
}

/**
 * Resolve a `?period=` query into concrete bounds.
 *
 * Never throws, and never discards a good field because of a bad one: each field
 * is read on its own, so `?period=mtd&from=garbage` still resolves to this
 * month. An unrecognised or contradictory query falls back to the current
 * fiscal year for the same reason — a hand-edited URL must not take the
 * dashboard down. `PeriodQuerySchema` in ./schemas is the strict validator for
 * API boundaries, where rejecting a malformed request is the correct answer.
 */
export function resolvePeriod(
  query: { period?: string; from?: string; to?: string } = {},
  now: Date = new Date(),
): ResolvedPeriod {
  const requested: PeriodKey = isPeriodKey(query.period) ? query.period : 'fy'

  if (requested === 'custom') {
    const from = query.from ? parseIsoDay(query.from) : null
    const toDay = query.to ? parseIsoDay(query.to) : null
    if (from && toDay && from.getTime() <= toDay.getTime()) {
      // `to` is inclusive in the UI and exclusive in every query.
      return withPrevious('custom', from, addDays(toDay, 1))
    }
    // Contradictory or incomplete custom range → fall through to the fiscal year.
  }

  if (requested === 'mtd') {
    const from = monthStart(now)
    return withPrevious('mtd', from, addMonths(from, 1), addMonths(from, -1))
  }

  if (requested === 'qtd') {
    const from = quarterStart(now)
    return withPrevious('qtd', from, addMonths(from, 3), addMonths(from, -3))
  }

  if (requested === '30d') {
    // Trailing 30 days including today: [today-29d, tomorrow).
    const to = addDays(dayStart(now), 1)
    const window = withPrevious('30d', addDays(to, -DAYS_PER_30), to)
    return {
      ...window,
      label: 'Last 30 days',
      previous: { ...window.previous, label: 'Previous 30 days' },
    }
  }

  const startYear = fyStartYear(now)
  return withPrevious(
    'fy',
    new Date(Date.UTC(startYear, 6, 1)),
    new Date(Date.UTC(startYear + 1, 6, 1)),
    new Date(Date.UTC(startYear - 1, 6, 1)),
  )
}

/** The first day of the month `count - 1` months before the month containing
 *  `to` — the lower bound for sparklines and the trend chart. */
export function trailingMonths(to: Date, count = 12): Date {
  return addMonths(monthStart(to), -(count - 1))
}

/** 'YYYY-MM' → 'Mar 26', for series axis labels. */
export function formatMonthBucket(bucket: string): string {
  const [y, m] = bucket.split('-')
  const monthIdx = Number(m) - 1
  if (!y || !MONTHS[monthIdx]) return bucket
  return `${MONTHS[monthIdx]} ${y.slice(-2)}`
}

/** The first instant of tomorrow, UTC. Stops a period that reaches into the
 *  future from advertising a future "as of". */
export function endOfUtcDay(now: Date = new Date()): Date {
  return addDays(dayStart(now), 1)
}
