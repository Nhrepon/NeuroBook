import { NextRequest } from 'next/server'
import { vouchers } from '@/db/schema'
import { requireScope, forbiddenResponse } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { VoucherTypeSchema, can, voucherTypePermission } from '@neurobook/shared'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const CreateSchema = z.object({
  date: z.string(),
  narration: z.string().min(1),
  voucherType: VoucherTypeSchema,
})

export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const type = req.nextUrl.searchParams.get('type')
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(vouchers).where(eq(vouchers.tenantId, scope.tenantId))
    return Response.json({ data: type ? rows.filter((r) => r.voucherType === type) : rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })
  if (!can(scope.role, voucherTypePermission(parsed.data.voucherType))) return forbiddenResponse()

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(vouchers).values({
      tenantId: scope.tenantId,
      date: new Date(parsed.data.date),
      narration: parsed.data.narration,
      voucherType: parsed.data.voucherType,
      createdBy: scope.userId,
    }).returning()

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'voucher.create',
      resourceType: 'voucher',
      resourceId: row.id,
      after: { voucherType: row.voucherType, date: row.date, narration: row.narration },
    }, tx)

    return Response.json({ data: row }, { status: 201 })
  })
}
