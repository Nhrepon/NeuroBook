import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { vouchers } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { VoucherTypeSchema } from '@neurobook/shared'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

const CreateSchema = z.object({
  date: z.string(),
  narration: z.string().min(1),
  voucherType: VoucherTypeSchema,
})

export async function GET() {
  const scope = await requireScope()
  const rows = await db.select().from(vouchers).where(eq(vouchers.tenantId, scope.tenantId))
  return Response.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })
  const [row] = await db.insert(vouchers).values({
    tenantId: scope.tenantId,
    date: new Date(parsed.data.date),
    narration: parsed.data.narration,
    voucherType: parsed.data.voucherType,
  }).returning()
  return Response.json({ data: row }, { status: 201 })
}
