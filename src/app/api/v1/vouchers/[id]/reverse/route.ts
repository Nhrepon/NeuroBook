import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { getVoucher } from '@/db/repo/vouchers'
import { buildReversal } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'
import { db } from '@/db/client'
import { vouchers } from '@/db/schema/accounting'
import { audit } from '@/db/repo/audit'

// POST /api/v1/vouchers/:id/reverse — R20 step-up is enforced by middleware
// (the request must carry a fresh purpose-scoped token).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()

  const original = await getVoucher(scope, id)
  if (!original) return err({ code: 'NOT_FOUND', message: 'Voucher not found' }, 404)
  if (original.status !== 'posted') {
    return err({ code: 'IMMUTABLE', message: 'Only posted vouchers can be reversed' }, 405)
  }

  const reason = (await req.json().catch(() => ({} as { reason?: string })))?.reason
  const reversal = buildReversal({
    original: {
      date: original.date.toISOString().slice(0, 10),
      narration: original.narration,
      voucherType: original.voucherType as VoucherType,
      entries: original.lines.map((l) => ({
        accountId: l.accountId,
        accountType: l.accountType,
        debit: l.debit,
        credit: l.credit,
        reference: l.reference ?? undefined,
      })),
    },
    reversalDate: new Date().toISOString().slice(0, 10),
    reversedByUserId: scope.userId,
    reason,
  })

  const [rev] = await db
    .insert(vouchers)
    .values({
      tenantId: scope.tenantId,
      voucherType: original.voucherType,
      date: new Date(reversal.date),
      narration: reversal.narration,
      createdBy: scope.userId,
      reversesId: original.id,
    })
    .returning()

  await audit(scope, {
    action: 'voucher.reverse',
    resourceType: 'voucher',
    resourceId: original.id,
    after: { reversalId: rev!.id, reason },
  })
  return ok({ reversalId: rev!.id })
}
