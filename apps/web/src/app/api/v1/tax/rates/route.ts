import { NextRequest } from 'next/server'
import { taxRates } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({ name: z.string().min(1), rate: z.number().int().nonnegative(), kind: z.string().optional() })

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(taxRates).where(eq(taxRates.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(taxRates).values({
      tenantId: scope.tenantId,
      name: parsed.data.name,
      rate: parsed.data.rate,
      kind: parsed.data.kind ?? 'vat',
    }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}
