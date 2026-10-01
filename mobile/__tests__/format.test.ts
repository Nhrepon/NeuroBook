// U3 — lakh/crore and dd/mm/yy formatters (mobile sanity).
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'

describe('format (mobile)', () => {
  it('taka from minor', () => {
    expect(formatTakaFromMinor(12345)).toBe('৳ 123.45')
  })
  it('date dd/mm/yy', () => {
    expect(formatDateBd('2025-09-15T00:00:00Z')).toBe('15/09/25')
  })
})
