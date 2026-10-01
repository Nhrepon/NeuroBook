// Report builders. Pure functions over a flat list of posted vouchers — the
// repository fetches and pre-aggregates; the engine derives the report.
import type { Account, AccountType, Voucher } from '../types'

export interface AccountBalance {
  account: Pick<Account, 'id' | 'name' | 'code' | 'type'>
  debit: number
  credit: number
  balance: number
}

export function trialBalance(vouchers: Voucher[]): AccountBalance[] {
  const byAccount = new Map<string, { acct: AccountBalance['account']; d: number; c: number }>()

  for (const v of vouchers) {
    if (v.status !== 'posted') continue
    for (const e of v.entries) {
      const key = e.accountId
      const row = byAccount.get(key) ?? {
        acct: { id: e.accountId, name: e.accountId, code: e.accountId, type: e.accountType },
        d: 0,
        c: 0,
      }
      row.d += e.debit
      row.c += e.credit
      byAccount.set(key, row)
    }
  }

  return [...byAccount.values()].map(({ acct, d, c }) => ({
    account: acct,
    debit: d,
    credit: c,
    balance: normalBalance(acct.type, d, c),
  }))
}

function normalBalance(type: AccountType, debit: number, credit: number): number {
  switch (type) {
    case 'ASSET':
    case 'EXPENSE':
      return debit - credit
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
      return credit - debit
  }
}

export interface PnLSection {
  revenue: AccountBalance[]
  expenses: AccountBalance[]
  netProfit: number
}

export function profitAndLoss(vouchers: Voucher[]): PnLSection {
  const balances = trialBalance(vouchers)
  const revenue = balances.filter((b) => b.account.type === 'REVENUE')
  const expenses = balances.filter((b) => b.account.type === 'EXPENSE')
  const totalRevenue = revenue.reduce((s, b) => s + b.balance, 0)
  const totalExpenses = expenses.reduce((s, b) => s + b.balance, 0)
  return { revenue, expenses, netProfit: totalRevenue - totalExpenses }
}

export interface BalanceSheet {
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  netProfit: number
  totalsAssets: number
  totalsLiabilitiesAndEquity: number
}

export function balanceSheet(vouchers: Voucher[]): BalanceSheet {
  const balances = trialBalance(vouchers)
  const pnl = profitAndLoss(vouchers)

  const assets = balances.filter((b) => b.account.type === 'ASSET')
  const liabilities = balances.filter((b) => b.account.type === 'LIABILITY')
  const equityBase = balances.filter((b) => b.account.type === 'EQUITY')

  // Current-period net profit is equity (retained earnings).
  const equity: AccountBalance[] = pnl.netProfit !== 0
    ? [
        ...equityBase,
        {
          account: { id: '__retained_earnings__', name: 'Retained Earnings (current)', code: '3900', type: 'EQUITY' },
          debit: 0,
          credit: 0,
          balance: pnl.netProfit,
        },
      ]
    : equityBase

  const totalsAssets = assets.reduce((s, b) => s + b.balance, 0)
  const totalsEquity = equity.reduce((s, b) => s + b.balance, 0)
  return {
    assets,
    liabilities,
    equity,
    netProfit: pnl.netProfit,
    totalsAssets,
    totalsLiabilitiesAndEquity:
      liabilities.reduce((s, b) => s + b.balance, 0) + totalsEquity,
  }
}
