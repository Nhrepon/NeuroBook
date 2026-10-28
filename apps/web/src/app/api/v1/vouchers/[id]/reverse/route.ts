import { NextRequest } from 'next/server'
import { vouchers } from '@/db/schema'
import { requireScope, forbiddenResponse } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { reverseVoucher } from '@/db/repo/reverse'
import { writeAudit } from '@/lib/audit'
import { can, voucherTypePermission, type VoucherType } from '@neurobook/shared'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => ({}))
  if (body?.idempotencyKey !== undefined && typeof body.idempotencyKey !== 'string') {
    return Response.json({ error: { code: 'VALIDATION', message: 'invalid idempotencyKey' } }, { status: 400 })
  }

  try {
    return await withTenant(scope.tenantId, async (tx) => {
      const [existing] = await tx
        .select({ voucherType: vouchers.voucherType })
        .from(vouchers)
        .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
      if (!existing) return Response.json({ error: { code: 'NOT_FOUND', message: 'voucher not found' } }, { status: 404 })
      if (!can(scope.role, voucherTypePermission(existing.voucherType as VoucherType))) return forbiddenResponse()

      const result = await reverseVoucher({
        tenantId: scope.tenantId,
        userId: scope.userId,
        voucherId: id,
        idempotencyKey: body?.idempotencyKey,
      }, tx)

      await writeAudit({
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'voucher.reverse',
        resourceType: 'voucher',
        resourceId: id,
        after: result,
      }, tx)

      return Response.json({ data: result }, { status: 200 })
    })
  } catch (e: any) {
    const msg = e?.message ?? 'INTERNAL'
    return Response.json({ error: { code: msg.startsWith('NOT_FOUND') ? 'NOT_FOUND' : 'VALIDATION', message: msg } }, { status: 400 })
  }
}
