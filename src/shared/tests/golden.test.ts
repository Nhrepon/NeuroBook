// O1: Golden ledger fixture. A fixed, hand-auditable set of books with
// hardcoded expected numbers. CI fails if it drifts.
//
// All amounts are minor units (taka × 100).
import { describe, it, expect } from 'vitest'
import { trialBalance, profitAndLoss, balanceSheet } from '../ledger/reports'
import type { Voucher } from '../types'

const fixture: Voucher[] = [
  // 1. Owner invests 1,000,000 taka (10,000,000 minor).
  postedVoucher([
    { accountId: 'cash', accountType: 'ASSET', debit: 10_000_000, credit: 0 },
    { accountId: 'equity', accountType: 'EQUITY', debit: 0, credit: 10_000_000 },
  ]),
  // 2. Buy inventory for 200,000 cash.
  postedVoucher([
    { accountId: 'inventory', accountType: 'ASSET', debit: 2_000_000, credit: 0 },
    { accountId: 'cash', accountType: 'ASSET', debit: 0, credit: 2_000_000 },
  ]),
  // 3. Sell 400,000 of goods for cash.
  postedVoucher([
    { accountId: 'cash', accountType: 'ASSET', debit: 4_000_000, credit: 0 },
    { accountId: 'revenue', accountType: 'REVENUE', debit: 0, credit: 4_000_000 },
  ]),
  // 4. Match cost: 300,000 COGS against inventory.
  postedVoucher([
    { accountId: 'cogs', accountType: 'EXPENSE', debit: 3_000_000, credit: 0 },
    { accountId: 'inventory', accountType: 'ASSET', debit: 0, credit: 3_000_000 },
  ]),
  // 5. Pay 50,000 rent.
  postedVoucher([
    { accountId: 'rent', accountType: 'EXPENSE', debit: 500_000, credit: 0 },
    { accountId: 'cash', accountType: 'ASSET', debit: 0, credit: 500_000 },
  ]),
]

// Hand-audit (minor units):
//   cash:      +10,000,000 − 2,000,000 + 4,000,000 − 500,000 = 11,500,000
//   inventory:  +2,000,000 − 3,000,000                       = −1,000,000
//   revenue:     +4,000,000 (credit side)
//   cogs:        −3,000,000   rent: −500,000
//   net profit:  4,000,000 − 3,000,000 − 500,000             =  500,000
//   assets:      11,500,000 + (−1,000,000)                   = 10,500,000
//   liab+eq+RE:  0 + 10,000,000 + 500,000                    = 10,500,000 ✓

describe('golden ledger fixture', () => {
  it('trial balance: Σdebit == Σcredit (in minor units)', () => {
    const tb = trialBalance(fixture)
    const d = tb.reduce((s, b) => s + b.debit, 0)
    const c = tb.reduce((s, b) => s + b.credit, 0)
    expect(d).toBe(c)
    expect(d).toBe(19_500_000)
  })

  it('P&L: net profit = revenue - expenses', () => {
    const pnl = profitAndLoss(fixture)
    expect(pnl.netProfit).toBe(500_000)
  })

  it('balance sheet: Assets == Liabilities + Equity + Retained Earnings', () => {
    const bs = balanceSheet(fixture)
    expect(bs.totalsAssets).toBe(bs.totalsLiabilitiesAndEquity)
    expect(bs.totalsAssets).toBe(10_500_000)
  })
})

function postedVoucher(entries: Voucher['entries']): Voucher {
  const d = entries.reduce((s, e) => s + e.debit, 0)
  const c = entries.reduce((s, e) => s + e.credit, 0)
  return {
    id: 'fixture',
    date: '2025-09-01',
    narration: 'fixture',
    entries,
    totalDebit: d,
    totalCredit: c,
    status: 'posted',
    version: 1,
    voucherType: 'JOURNAL',
    tenantId: 'fixture',
  }
}
