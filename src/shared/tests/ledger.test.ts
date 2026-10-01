// Property tests for the ledger engine (O1).
// 90%+ coverage target. These run in pure Node — no DB, no network.
import { describe, it, expect } from 'vitest'
import { validateForPost, computeTotals } from '../ledger/post'
import { buildReversal } from '../ledger/reversal'
import { trialBalance, profitAndLoss, balanceSheet } from '../ledger/reports'
import { isBalanced } from '../money'
import type { JournalEntry, Voucher } from '../types'

function randomEntries(n: number, maxMinor: number): JournalEntry[] {
  const out: JournalEntry[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      accountId: `acc-${i}`,
      accountType: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'][i % 5] as JournalEntry['accountType'],
      debit: Math.floor(Math.random() * maxMinor),
      credit: 0,
      reference: '',
    })
  }
  // Make the LAST entry the balancing credit line.
  const totalDebit = out.reduce((s, e) => s + e.debit, 0)
  out.push({ accountId: 'acc-bal', accountType: 'LIABILITY', debit: 0, credit: totalDebit })
  return out
}

describe('ledger', () => {
  it('validateForPost accepts a balanced voucher', () => {
    const entries: JournalEntry[] = [
      { accountId: 'cash', accountType: 'ASSET', debit: 1000, credit: 0 },
      { accountId: 'revenue', accountType: 'REVENUE', debit: 0, credit: 1000 },
    ]
    const r = validateForPost({ entries, status: 'draft' })
    expect(r.totalDebit).toBe(1000)
    expect(r.totalCredit).toBe(1000)
  })

  it('validateForPost rejects fewer than two entries', () => {
    expect(() =>
      validateForPost({
        entries: [{ accountId: 'a', accountType: 'ASSET', debit: 0, credit: 0 }],
        status: 'draft',
      }),
    ).toThrow(/at least two/)
  })

  it('validateForPost rejects unbalanced', () => {
    const entries: JournalEntry[] = [
      { accountId: 'a', accountType: 'ASSET', debit: 100, credit: 0 },
      { accountId: 'b', accountType: 'REVENUE', debit: 0, credit: 99 },
    ]
    expect(() => validateForPost({ entries, status: 'draft' })).toThrow(/equal/)
  })

  it('validateForPost rejects a line with both debit and credit', () => {
    const entries: JournalEntry[] = [
      { accountId: 'a', accountType: 'ASSET', debit: 50, credit: 50 },
      { accountId: 'b', accountType: 'ASSET', debit: 0, credit: 0 },
    ]
    expect(() => validateForPost({ entries, status: 'draft' })).toThrow(/cannot have both/)
  })

  it('validateForPost rejects posting a posted voucher', () => {
    const entries: JournalEntry[] = [
      { accountId: 'a', accountType: 'ASSET', debit: 100, credit: 0 },
      { accountId: 'b', accountType: 'REVENUE', debit: 0, credit: 100 },
    ]
    expect(() => validateForPost({ entries, status: 'posted' })).toThrow(/already posted/)
  })

  it('validateForPost rejects a closed period', () => {
    const entries: JournalEntry[] = [
      { accountId: 'a', accountType: 'ASSET', debit: 100, credit: 0 },
      { accountId: 'b', accountType: 'REVENUE', debit: 0, credit: 100 },
    ]
    expect(() =>
      validateForPost({ entries, status: 'draft', periodClosed: true }),
    ).toThrow(/closed/)
  })

  it('reversal flips every line and nets the original to zero', () => {
    const original: Voucher['entries'] = [
      { accountId: 'cash', accountType: 'ASSET', debit: 5000, credit: 0 },
      { accountId: 'sales', accountType: 'REVENUE', debit: 0, credit: 5000 },
    ]
    const reversal = buildReversal({
      original: { date: '2025-09-01', narration: 'Sale', voucherType: 'SALES_INVOICE', entries: original },
      reversalDate: '2025-09-15',
      reversedByUserId: 'u-1',
      reason: 'Wrong amount',
    })
    // A reversal FLIPS each line: the original debit-5000 cash line becomes
    // a credit-5000 cash line.
    expect(reversal.entries[0]!.debit).toBe(0)
    expect(reversal.entries[0]!.credit).toBe(5000)
    expect(reversal.entries[1]!.debit).toBe(5000)
    expect(reversal.entries[1]!.credit).toBe(0)
    // Combined: original + reversal should net to zero on every account.
    const combined: JournalEntry[] = [
      ...original,
      ...reversal.entries,
    ]
    expect(isBalanced(combined)).toBe(true)
  })

  it('trial balance: Σdebit == Σcredit across random vouchers', () => {
    const vouchers: Voucher[] = []
    for (let i = 0; i < 50; i++) {
      const entries = randomEntries(5, 100_000)
      const totals = computeTotals({ entries })
      vouchers.push({
        id: `v-${i}`,
        date: '2025-09-01',
        narration: 'test',
        entries,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        status: 'posted',
        version: 1,
        voucherType: 'JOURNAL',
        tenantId: 't-1',
      })
    }
    const tb = trialBalance(vouchers)
    const d = tb.reduce((s, b) => s + b.debit, 0)
    const c = tb.reduce((s, b) => s + b.credit, 0)
    expect(d).toBe(c)
  })

  it('balance sheet: Assets == Liabilities + Equity + RetainedEarnings', () => {
    // One asset, one liability, one revenue — the equation must hold.
    const vouchers: Voucher[] = [
      voucher([
        { accountId: 'cash', accountType: 'ASSET', debit: 10000, credit: 0 },
        { accountId: 'revenue', accountType: 'REVENUE', debit: 0, credit: 10000 },
      ]),
      voucher([
        { accountId: 'cash', accountType: 'ASSET', debit: 0, credit: 4000 },
        { accountId: 'payable', accountType: 'LIABILITY', debit: 4000, credit: 0 },
      ]),
    ]
    const bs = balanceSheet(vouchers)
    expect(bs.totalsAssets).toBe(bs.totalsLiabilitiesAndEquity)
  })
})

function voucher(entries: JournalEntry[]): Voucher {
  const d = entries.reduce((s, e) => s + e.debit, 0)
  const c = entries.reduce((s, e) => s + e.credit, 0)
  return {
    id: 'v',
    date: '2025-09-01',
    narration: 'test',
    entries,
    totalDebit: d,
    totalCredit: c,
    status: 'posted',
    version: 1,
    voucherType: 'JOURNAL',
    tenantId: 't-1',
  }
}
