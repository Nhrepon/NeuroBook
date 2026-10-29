import { eq } from 'drizzle-orm'
import { journalLines, accounts } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'
import { notFound } from '@/controllers/errors'
import { trialBalance, profitAndLoss, balanceSheet } from '@neurobook/shared'

export async function getReport(type: string) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx
      .select({
        voucherId: journalLines.voucherId,
        accountId: journalLines.accountId,
        accountType: journalLines.accountType,
        debit: journalLines.debit,
        credit: journalLines.credit,
        accountName: accounts.name,
        accountCode: accounts.code,
      })
      .from(journalLines)
      .leftJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(eq(journalLines.tenantId, scope.tenantId))

    const byVoucher = new Map<string, { entries: { accountId: string; accountType: any; debit: number; credit: number }[] }>()
    for (const r of rows) {
      const v = byVoucher.get(r.voucherId) ?? { entries: [] }
      v.entries.push({ accountId: r.accountId, accountType: r.accountType, debit: r.debit, credit: r.credit })
      byVoucher.set(r.voucherId, v)
    }
    const reportVouchers = Array.from(byVoucher.values())

    if (type === 'trial-balance') {
      const tb = trialBalance(reportVouchers)
      const map = new Map<string, { accountId: string; accountName: string; code: string; debit: number; credit: number }>()
      for (const r of rows) {
        const cur = map.get(r.accountId) ?? {
          accountId: r.accountId,
          accountName: r.accountName ?? '',
          code: r.accountCode ?? '',
          debit: 0,
          credit: 0,
        }
        cur.debit += r.debit
        cur.credit += r.credit
        map.set(r.accountId, cur)
      }
      return { rows: Array.from(map.values()), totals: tb }
    }

    if (type === 'profit-loss') return profitAndLoss(reportVouchers)
    if (type === 'balance-sheet') return balanceSheet(reportVouchers)

    throw notFound('unknown report')
  })
}