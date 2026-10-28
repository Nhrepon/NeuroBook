import { NextRequest } from 'next/server'
import { parties } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({
  name: z.string().min(1),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const type = req.nextUrl.searchParams.get('type')
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(parties).where(eq(parties.tenantId, scope.tenantId))
    return Response.json({ data: type ? rows.filter((r) => r.type === type) : rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(parties).values({ tenantId: scope.tenantId, ...parsed.data }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}
