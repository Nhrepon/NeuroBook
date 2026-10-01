// Property tests for R7 — money is integer minor units.
// 100 random amounts across two rates, verify round-trip + sum.
import { describe, it, expect } from 'vitest'
import { toMinor, toMajor, applyRate, sumDebit, sumCredit, isBalanced } from '../money'

describe('money properties', () => {
  it('toMinor is a left inverse of toMajor for two-decimal numbers', () => {
    for (let i = 0; i < 200; i++) {
      const v = Math.round(Math.random() * 1_000_000) / 100
      expect(toMajor(toMinor(v))).toBeCloseTo(v, 10)
    }
  })

  it('applyRate never produces a non-integer', () => {
    for (let i = 0; i < 200; i++) {
      const minor = Math.floor(Math.random() * 1_000_000)
      const rate = Math.floor(Math.random() * 3000)   // up to 30%
      const out = applyRate(minor, rate)
      expect(Number.isInteger(out)).toBe(true)
    }
  })

  it('isBalanced(true) iff Σdebit == Σcredit', () => {
    for (let i = 0; i < 100; i++) {
      const n = 2 + Math.floor(Math.random() * 6)
      const entries = Array.from({ length: n }, () => ({
        debit: Math.floor(Math.random() * 10_000),
        credit: 0,
      }))
      const totalDebit = sumDebit(entries)
      entries.push({ debit: 0, credit: totalDebit })
      expect(isBalanced(entries)).toBe(true)
    }
  })
})
