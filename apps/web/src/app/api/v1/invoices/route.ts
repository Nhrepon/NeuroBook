import { NextRequest } from 'next/server'
import { invoices, parties } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  date: z.string(),
  total: z.number().int().nonnegative(),
  vat: z.number().int().nonnegative().optional(),
  number: z.string().optional(),
})

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(invoices).where(eq(invoices.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    let customerId = parsed.data.customerId
    if (!customerId && parsed.data.customerName) {
      const [p] = await tx.insert(parties).values({
        tenantId: scope.tenantId,
        name: parsed.data.customerName,
        type: 'CUSTOMER',
      }).returning()
      customerId = p.id
    }

    const [row] = await tx.insert(invoices).values({
      tenantId: scope.tenantId,
      customerId: customerId ?? null,
      date: new Date(parsed.data.date),
      total: parsed.data.total,
      vat: parsed.data.vat ?? 0,
      number: parsed.data.number,
    }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}
