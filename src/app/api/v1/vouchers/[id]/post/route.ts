import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { postVoucher } from '@/db/repo/post'
import { getVoucher } from '@/db/repo/vouchers'
import { audit } from '@/db/repo/audit'
import type { VoucherType } from '@neurobook/shared'

// POST /api/v1/vouchers/:id/post — REQUIRES connectivity (§5.11, §15.3).
// Posting is never queueable: a queued retry cannot become a post.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()

  const draft = await getVoucher(scope, id)
  if (!draft) return err({ code: 'NOT_FOUND', message: 'Voucher not found' }, 404)
  if (draft.status !== 'draft') {
    return err({ code: 'IMMUTABLE', message: 'Already posted' }, 405)
  }

  try {
    const result = await postVoucher({
      tenantId: scope.tenantId,
      userId: scope.userId,
      voucherId: draft.id,
      date: draft.date.toISOString().slice(0, 10),
      narration: draft.narration,
      voucherType: draft.voucherType as VoucherType,
      entries: draft.lines.map((l) => ({
        accountId: l.accountId,
        accountType: l.accountType,
        debit: l.debit,
        credit: l.credit,
        reference: l.reference ?? undefined,
      })),
    })
    await audit(scope, { action: 'voucher.post', resourceType: 'voucher', resourceId: id })
    return ok(result)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('PERIOD_LOCKED')) {
      return err({ code: 'PERIOD_LOCKED', message: 'Period is closed' }, 409)
    }
    if (msg.startsWith('UNBALANCED')) {
      return err({ code: 'UNBALANCED', message: msg }, 422)
    }
    return err({ code: 'INTERNAL', message: msg }, 500)
  }
}
