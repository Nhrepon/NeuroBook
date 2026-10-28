import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { vouchers } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { postVoucher } from '@/db/repo/post'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const BodySchema = z.object({
  date: z.string(),
  narration: z.string(),
  voucherType: z.string(),
  entries: z.array(z.object({
    accountId: z.string().uuid(),
    accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
    debit: z.number().int().nonnegative(),
    credit: z.number().int().nonnegative(),
    reference: z.string().optional(),
  })),
  idempotencyKey: z.string().optional(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  const [draft] = await db.select().from(vouchers).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
  if (!draft) return Response.json({ error: { code: 'NOT_FOUND', message: 'voucher not found' } }, { status: 404 })

  try {
    const result = await postVoucher({
      tenantId: scope.tenantId,
      userId: scope.userId,
      voucherId: id,
      date: parsed.data.date,
      narration: parsed.data.narration,
      voucherType: parsed.data.voucherType as any,
      entries: parsed.data.entries as any,
      idempotencyKey: parsed.data.idempotencyKey,
    })
    return Response.json({ data: result }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message ?? 'INTERNAL'
    const code = msg.startsWith('PERIOD_LOCKED') ? 'PERIOD_LOCKED' : msg.startsWith('UNBALANCED') ? 'UNBALANCED' : 'VALIDATION'
    return Response.json({ error: { code, message: msg } }, { status: 400 })
  }
}
