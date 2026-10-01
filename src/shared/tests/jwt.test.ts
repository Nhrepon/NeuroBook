import { describe, it, expect } from 'vitest'
import { isExpired, DEFAULT_ACCESS_TTL, DEFAULT_REFRESH_TTL } from '../auth/jwt'

describe('auth/jwt', () => {
  it('DEFAULT_ACCESS_TTL is 15 minutes (R13)', () => {
    expect(DEFAULT_ACCESS_TTL).toBe(900)
  })
  it('DEFAULT_REFRESH_TTL is 7 days (R13)', () => {
    expect(DEFAULT_REFRESH_TTL).toBe(7 * 24 * 60 * 60)
  })
  it('isExpired respects skew', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(isExpired({ exp: now + 60 })).toBe(false)
    expect(isExpired({ exp: now - 60 })).toBe(true)
    expect(isExpired({ exp: now - 10 }, 30)).toBe(true)   // 10s past, 30s skew
    expect(isExpired({ exp: now + 100 }, 30)).toBe(false)
  })
})
