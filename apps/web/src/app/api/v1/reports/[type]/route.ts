import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { journalLines, accounts } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { eq } from 'drizzle-orm'
import { trialBalance, profitAndLoss, balanceSheet } from '@neurobook/shared'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params
  const scope = await requireScope()

  const rows = await db
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

  // Group lines by voucher to feed the shared report functions.
  const byVoucher = new Map<string, { entries: { accountId: string; accountType: any; debit: number; credit: number }[] }>()
  for (const r of rows) {
    const v = byVoucher.get(r.voucherId) ?? { entries: [] }
    v.entries.push({ accountId: r.accountId, accountType: r.accountType, debit: r.debit, credit: r.credit })
    byVoucher.set(r.voucherId, v)
  }
  const vouchers = Array.from(byVoucher.values())

  if (type === 'trial-balance') {
    const tb = trialBalance(vouchers)
    // aggregate per account for display
    const map = new Map<string, { accountId: string; accountName: string; code: string; debit: number; credit: number }>()
    for (const r of rows) {
      const cur = map.get(r.accountId) ?? { accountId: r.accountId, accountName: r.accountName ?? '', code: r.accountCode ?? '', debit: 0, credit: 0 }
      cur.debit += r.debit
      cur.credit += r.credit
      map.set(r.accountId, cur)
    }
    const data = Array.from(map.values())
    return Response.json({ data: { rows: data, totals: tb } })
  }

  if (type === 'profit-loss') {
    const pl = profitAndLoss(vouchers)
    return Response.json({ data: pl })
  }

  if (type === 'balance-sheet') {
    const bs = balanceSheet(vouchers)
    return Response.json({ data: bs })
  }

  return Response.json({ error: { code: 'NOT_FOUND', message: 'unknown report' } }, { status: 404 })
}
