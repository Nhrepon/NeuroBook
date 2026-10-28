import { NextRequest } from 'next/server'
import { accounts } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().uuid().optional(),
  isGroup: z.boolean().optional(),
  openingBalance: z.number().int().optional(),
})

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(accounts).where(eq(accounts.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(accounts).values({
      tenantId: scope.tenantId,
      name: parsed.data.name,
      code: parsed.data.code,
      type: parsed.data.type,
      parentId: parsed.data.parentId ?? null,
      isGroup: parsed.data.isGroup ?? false,
      openingBalance: parsed.data.openingBalance ?? 0,
    }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}
