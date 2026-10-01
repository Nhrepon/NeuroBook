// Money rounding — boundary cases for R7. 100% coverage target.
import { describe, it, expect } from 'vitest'
import {
  toMinor,
  toMajor,
  applyRate,
  roundMilliToMinor,
  sumDebit,
  sumCredit,
  isBalanced,
  roundingResidual,
} from '../money'

describe('money', () => {
  it('toMinor / toMajor round-trip', () => {
    expect(toMinor(123.45)).toBe(12345)
    expect(toMinor('123.45')).toBe(12345)
    expect(toMajor(12345)).toBe(123.45)
  })

  it('toMinor rejects NaN', () => {
    expect(() => toMinor('not-a-number')).toThrow()
  })

  it('applyRate at standard 15%', () => {
    expect(applyRate(10000, 1500)).toBe(1500) // 15% of 100.00
  })

  it('applyRate at reduced 7.5% with fractional quantity', () => {
    // 2.50 taka × 7.5% = 0.1875 taka → 19 minor (R7 millitaka precision)
    expect(applyRate(250, 750)).toBe(19)
  })

  it('applyRate at zero', () => {
    expect(applyRate(0, 1500)).toBe(0)
  })

  it('roundMilliToMinor half-up', () => {
    expect(roundMilliToMinor(5)).toBe(1)    // 0.005 taka = 0.5 minor → 1
    expect(roundMilliToMinor(4)).toBe(0)    // 0.004 taka = 0.4 minor → 0
    expect(roundMilliToMinor(15)).toBe(2)   // 0.015 taka = 1.5 minor → 2
  })

  it('sums', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 100 },
    ]
    expect(sumDebit(entries)).toBe(100)
    expect(sumCredit(entries)).toBe(100)
    expect(isBalanced(entries)).toBe(true)
  })

  it('unbalanced detected', () => {
    const entries = [
      { debit: 100, credit: 0 },
      { debit: 0, credit: 99 },
    ]
    expect(isBalanced(entries)).toBe(false)
    expect(roundingResidual(entries)).toBe(1)
  })
})
