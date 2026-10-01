// U3 — lakh/crore and dd/mm/yy formatters.
import { describe, it, expect } from 'vitest'
import {
  formatLakhCrore,
  formatTaka,
  formatTakaFromMinor,
  formatDateBd,
  currentFiscalYear,
} from '../format/bd'

describe('format/bd', () => {
  it('lakh grouping for 1,23,45,678.90', () => {
    expect(formatLakhCrore(12345678.9, true)).toBe('1,23,45,678.90')
  })

  it('taka from minor (R7)', () => {
    expect(formatTakaFromMinor(12345)).toBe('৳ 123.45')
  })

  it('taka from major', () => {
    expect(formatTaka(12345.67)).toBe('৳ 12,345.67')
  })

  it('date dd/mm/yy', () => {
    expect(formatDateBd('2025-09-15T00:00:00Z')).toBe('15/09/25')
  })

  it('fiscal year before July', () => {
    const fy = currentFiscalYear(new Date('2025-03-15T00:00:00Z'))
    expect(fy.label).toBe('FY 2024-25')
    expect(fy.start.toISOString()).toBe('2024-07-01T00:00:00.000Z')
    expect(fy.end.toISOString()).toBe('2025-06-30T23:59:59.000Z')
  })

  it('fiscal year after July', () => {
    const fy = currentFiscalYear(new Date('2025-09-15T00:00:00Z'))
    expect(fy.label).toBe('FY 2025-26')
  })
})
