// §5.5 — NBR fiscal year 1 Jul – 30 Jun.
import { describe, it, expect } from 'vitest'
import { currentFiscalYear } from '../format/bd'

describe('fiscalYear', () => {
  it('before July → previous year is the start', () => {
    const fy = currentFiscalYear(new Date('2025-03-15'))
    expect(fy.label).toBe('FY 2024-25')
    expect(fy.start.toISOString().slice(0, 10)).toBe('2024-07-01')
  })
  it('on/after July → current year is the start', () => {
    const fy = currentFiscalYear(new Date('2025-07-01'))
    expect(fy.label).toBe('FY 2025-26')
  })
  it('end date is 30 June next year', () => {
    const fy = currentFiscalYear(new Date('2025-09-15'))
    expect(fy.end.toISOString().slice(0, 10)).toBe('2026-06-30')
  })
})
