// Period-window tests. Pure, no DB, no clock: every case pins `now`.
import { describe, expect, it } from 'vitest'
import { endOfUtcDay, formatMonthBucket, resolvePeriod, trailingMonths } from '../periods'

/** 2026-03-15T08:30Z — a Sunday inside FY 2025-26, in the third NBR quarter. */
const NOW = new Date('2026-03-15T08:30:00.000Z')
const at = (d: Date) => d.toISOString()

describe('resolvePeriod — fiscal year (NBR: 1 Jul – 30 Jun)', () => {
  it('defaults to the current fiscal year', () => {
    const p = resolvePeriod({}, NOW)
    expect(p.key).toBe('fy')
    expect(p.label).toBe('FY 2025-26')
    expect(at(p.from)).toBe('2025-07-01T00:00:00.000Z')
    expect(at(p.to)).toBe('2026-07-01T00:00:00.000Z')
    expect(p.granularity).toBe('month')
  })

  it('keeps 30 June in the year that started the previous July', () => {
    const p = resolvePeriod({ period: 'fy' }, new Date('2026-06-30T23:59:59.000Z'))
    expect(p.label).toBe('FY 2025-26')
    expect(at(p.to)).toBe('2026-07-01T00:00:00.000Z')
  })

  it('rolls to the next fiscal year exactly on 1 July', () => {
    const p = resolvePeriod({ period: 'fy' }, new Date('2026-07-01T00:00:00.000Z'))
    expect(p.label).toBe('FY 2026-27')
    expect(at(p.from)).toBe('2026-07-01T00:00:00.000Z')
    expect(at(p.to)).toBe('2027-07-01T00:00:00.000Z')
  })

  it('places the previous fiscal year immediately before it', () => {
    const p = resolvePeriod({ period: 'fy' }, NOW)
    expect(p.previous.label).toBe('FY 2024-25')
    expect(at(p.previous.from)).toBe('2024-07-01T00:00:00.000Z')
    expect(at(p.previous.to)).toBe('2025-07-01T00:00:00.000Z')
  })
})

describe('resolvePeriod — month and quarter', () => {
  it('resolves the month to date', () => {
    const p = resolvePeriod({ period: 'mtd' }, NOW)
    expect(p.label).toBe('Mar 2026')
    expect(at(p.from)).toBe('2026-03-01T00:00:00.000Z')
    expect(at(p.to)).toBe('2026-04-01T00:00:00.000Z')
    expect(p.granularity).toBe('day')
    expect(p.previous.label).toBe('Feb 2026')
    expect(at(p.previous.from)).toBe('2026-02-01T00:00:00.000Z')
  })

  it('anchors quarters to the fiscal year, not the calendar year', () => {
    // Jan–Mar is Q3 of the NBR year, not Q1 of the calendar year.
    const q3 = resolvePeriod({ period: 'qtd' }, NOW)
    expect(q3.label).toBe('Q3 FY 2025-26')
    expect(at(q3.from)).toBe('2026-01-01T00:00:00.000Z')
    expect(at(q3.to)).toBe('2026-04-01T00:00:00.000Z')
    expect(q3.previous.label).toBe('Q2 FY 2025-26')

    const q1 = resolvePeriod({ period: 'qtd' }, new Date('2026-08-15T00:00:00.000Z'))
    expect(q1.label).toBe('Q1 FY 2026-27')
    expect(at(q1.from)).toBe('2026-07-01T00:00:00.000Z')
    expect(at(q1.to)).toBe('2026-10-01T00:00:00.000Z')

    const q4 = resolvePeriod({ period: 'qtd' }, new Date('2026-05-02T00:00:00.000Z'))
    expect(q4.label).toBe('Q4 FY 2025-26')
    expect(at(q4.from)).toBe('2026-04-01T00:00:00.000Z')
    expect(at(q4.to)).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('resolvePeriod — rolling 30 days', () => {
  it('includes today and ends at tomorrow', () => {
    const p = resolvePeriod({ period: '30d' }, NOW)
    expect(p.label).toBe('Last 30 days')
    expect(at(p.to)).toBe('2026-03-16T00:00:00.000Z')
    expect(at(p.from)).toBe('2026-02-14T00:00:00.000Z')
    expect(at(p.previous.from)).toBe('2026-01-15T00:00:00.000Z')
    expect(p.previous.label).toBe('Previous 30 days')
    expect(p.granularity).toBe('day')
  })
})


describe('resolvePeriod — custom range', () => {
  it('treats the inclusive `to` day as the start of the next day', () => {
    const p = resolvePeriod({ period: 'custom', from: '2026-01-01', to: '2026-01-31' }, NOW)
    expect(at(p.from)).toBe('2026-01-01T00:00:00.000Z')
    expect(at(p.to)).toBe('2026-02-01T00:00:00.000Z')
    expect(p.label).toBe('01/01/26 – 31/01/26')
  })

  it('accepts a single-day range', () => {
    const p = resolvePeriod({ period: 'custom', from: '2026-01-01', to: '2026-01-01' }, NOW)
    expect(at(p.from)).toBe('2026-01-01T00:00:00.000Z')
    expect(at(p.to)).toBe('2026-01-02T00:00:00.000Z')
  })
})

describe('resolvePeriod — malformed input degrades, never throws', () => {
  it('falls back to the fiscal year for an unknown period', () => {
    const p = resolvePeriod({ period: 'nonsense' }, NOW)
    expect(p.key).toBe('fy')
    expect(p.label).toBe('FY 2025-26')
  })

  it('keeps a valid period when another field is junk', () => {
    // The case that matters: one bad parameter must not silently widen the
    // window the user asked for.
    const p = resolvePeriod({ period: 'mtd', from: 'garbage' }, NOW)
    expect(p.key).toBe('mtd')
    expect(p.label).toBe('Mar 2026')
  })

  it('falls back when a custom range is missing a bound', () => {
    expect(resolvePeriod({ period: 'custom', from: '2026-01-01' }, NOW).key).toBe('fy')
    expect(resolvePeriod({ period: 'custom' }, NOW).key).toBe('fy')
  })

  it('falls back when a custom range is inverted or impossible', () => {
    const inverted = { period: 'custom', from: '2026-02-01', to: '2026-01-01' }
    expect(resolvePeriod(inverted, NOW).key).toBe('fy')

    // 30 February does not exist; it must not roll over into March.
    const impossible = { period: 'custom', from: '2026-02-30', to: '2026-03-01' }
    expect(resolvePeriod(impossible, NOW).key).toBe('fy')
  })
})

describe('resolvePeriod — previous window invariants', () => {
  it('always ends exactly where the current window begins', () => {
    for (const period of ['mtd', 'qtd', 'fy', '30d']) {
      const p = resolvePeriod({ period }, NOW)
      expect(p.previous.to.getTime(), period).toBe(p.from.getTime())
    }
  })

  it('steps back one whole calendar unit for month, quarter, and year', () => {
    // An equal-length shift would move back 31 days from a 31-day month, which
    // is the previous month only when the two months happen to be the same
    // length.
    const mtd = resolvePeriod({ period: 'mtd' }, new Date('2026-03-15T00:00:00.000Z'))
    expect(at(mtd.previous.from)).toBe('2026-02-01T00:00:00.000Z')

    const qtd = resolvePeriod({ period: 'qtd' }, NOW)
    expect(at(qtd.previous.from)).toBe('2025-10-01T00:00:00.000Z')
  })

  it('does not drift a day when the fiscal year contains a leap day', () => {
    // FY 2023-24 spans 366 days. Shifting back 365 would land on 30 June 2022
    // and quietly pull a day of the year before into the comparison.
    const p = resolvePeriod({ period: 'fy' }, new Date('2024-02-15T00:00:00.000Z'))
    expect(p.label).toBe('FY 2023-24')
    expect(at(p.previous.from)).toBe('2022-07-01T00:00:00.000Z')
    expect(at(p.previous.to)).toBe('2023-07-01T00:00:00.000Z')
    expect(p.previous.label).toBe('FY 2022-23')
  })

  it('keeps the equal-length shift for rolling windows', () => {
    const p = resolvePeriod({ period: '30d' }, NOW)
    expect(p.previous.to.getTime() - p.previous.from.getTime()).toBe(
      p.to.getTime() - p.from.getTime(),
    )
  })
})

describe('series helpers', () => {
  it('starts the trailing window 11 months before the month of `to`', () => {
    expect(at(trailingMonths(new Date('2026-03-16T00:00:00.000Z'), 12))).toBe(
      '2025-04-01T00:00:00.000Z',
    )
  })

  it('ends the day after the given day', () => {
    expect(at(endOfUtcDay(NOW))).toBe('2026-03-16T00:00:00.000Z')
    // Midnight belongs to the day it opens, not the one before.
    expect(at(endOfUtcDay(new Date('2026-03-15T00:00:00.000Z')))).toBe('2026-03-16T00:00:00.000Z')
  })

  it('labels month buckets, and leaves anything else alone', () => {
    expect(formatMonthBucket('2026-03')).toBe('Mar 26')
    expect(formatMonthBucket('2026-12')).toBe('Dec 26')
    expect(formatMonthBucket('garbage')).toBe('garbage')
    expect(formatMonthBucket('2026-13')).toBe('2026-13')
  })
})
