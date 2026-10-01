import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { getVoucher } from '@/db/repo/vouchers'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { vouchers, journalLines } from '@/db/schema/accounting'
import { and, eq, sql } from 'drizzle-orm'
import { VoucherDraftObject } from '@neurobook/shared'
import { audit } from '@/db/repo/audit'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const v = await getVoucher(scope, id)
  if (!v) return err({ code: 'NOT_FOUND', message: 'Voucher not found' }, 404)
  return ok(v)
}

// PATCH /api/v1/vouchers/:id — edit a DRAFT only. Posted → 405 (R1).
// VoucherDraftObject.partial() makes every field optional; the base object
// already carries voucherType and entries, so no .extend() needed.
const PatchSchema = VoucherDraftObject.partial()

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const existing = await getVoucher(scope, id)
  if (!existing) return err({ code: 'NOT_FOUND', message: 'Voucher not found' }, 404)
  if (existing.status !== 'draft') {
    return err({ code: 'IMMUTABLE', message: 'Posted vouchers cannot be edited' }, 405)
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }

  // R5: optimistic concurrency.
  const expectedVersion = Number(req.headers.get('x-version') ?? existing.version)
  const [updated] = await db
    .update(vouchers)
    .set({
      ...(parsed.data.date && { date: new Date(parsed.data.date) }),
      ...(parsed.data.narration && { narration: parsed.data.narration }),
      ...(parsed.data.voucherType && { voucherType: parsed.data.voucherType }),
      version: sql`${vouchers.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId), eq(vouchers.version, expectedVersion)))
    .returning()
  if (!updated) {
    return err({ code: 'CONFLICT', message: 'Version mismatch', retryable: true }, 409)
  }

  if (parsed.data.entries) {
    await db.delete(journalLines).where(eq(journalLines.voucherId, id))
    await db.insert(journalLines).values(
      parsed.data.entries.map((e, i) => ({
        tenantId: scope.tenantId,
        voucherId: id,
        accountId: e.accountId,
        accountType: e.accountType,
        debit: e.debit,
        credit: e.credit,
        reference: e.reference ?? null,
        lineOrder: i,
      })),
    )
  }

  await audit(scope, { action: 'voucher.draft.update', resourceType: 'voucher', resourceId: id })
  return ok(updated)
}
