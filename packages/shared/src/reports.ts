import type { JournalEntry } from './types'

export interface VoucherLike { entries: JournalEntry[] }

export function trialBalance(vouchers: VoucherLike[]): { debit: number; credit: number } {
  return vouchers.reduce((acc, v) => {
    const t = v.entries.reduce((a, e) => ({ debit: a.debit + e.debit, credit: a.credit + e.credit }), { debit: 0, credit: 0 })
    return { debit: acc.debit + t.debit, credit: acc.credit + t.credit }
  }, { debit: 0, credit: 0 })
}

export function profitAndLoss(vouchers: VoucherLike[]): { revenue: number; expenses: number; net: number } {
  let revenue = 0, expenses = 0
  for (const v of vouchers) for (const e of v.entries) {
    if (e.accountType === 'REVENUE') revenue += e.credit - e.debit
    if (e.accountType === 'EXPENSE') expenses += e.debit - e.credit
  }
  return { revenue, expenses, net: revenue - expenses }
}

export function balanceSheet(vouchers: VoucherLike[]): { assets: number; liabilities: number; equity: number } {
  let assets = 0, liabilities = 0, equity = 0
  for (const v of vouchers) for (const e of v.entries) {
    const net = e.debit - e.credit
    if (e.accountType === 'ASSET') assets += net
    if (e.accountType === 'LIABILITY') liabilities -= net
    if (e.accountType === 'EQUITY') equity -= net
  }
  return { assets, liabilities, equity }
}
