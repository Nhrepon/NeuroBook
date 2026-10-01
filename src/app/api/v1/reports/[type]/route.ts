import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { listVouchers } from '@/db/repo/vouchers'
import { trialBalance, profitAndLoss, balanceSheet } from '@neurobook/shared/ledger'

// GET /api/v1/reports/:type?from=&to=
// `from`/`to` bound the posted-voucher window (period selector, U3).
export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params
  const scope = await requireScope()
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const { items } = await listVouchers(scope, { status: 'posted', from, to, limit: 500 })
  switch (type) {
    case 'trial-balance':
      return ok(trialBalance(items as never))
    case 'profit-loss':
      return ok(profitAndLoss(items as never))
    case 'balance-sheet':
      return ok(balanceSheet(items as never))
    default:
      return err({ code: 'NOT_FOUND', message: `Unknown report: ${type}` }, 404)
  }
}
