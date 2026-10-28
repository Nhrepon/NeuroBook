import { NextRequest } from 'next/server'
import { fiscalPeriods } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({ label: z.string().min(1), startDate: z.string(), endDate: z.string(), status: z.enum(['open', 'closed']).optional() })

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(fiscalPeriods).where(eq(fiscalPeriods.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(fiscalPeriods).values({
      tenantId: scope.tenantId,
      label: parsed.data.label,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      status: parsed.data.status ?? 'open',
    }).returning()
    return Response.json({ data: row }, { status: 201 })
  })
}

export async function PATCH(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const { id, status } = body ?? {}
  if (!id || !status) return Response.json({ error: { code: 'VALIDATION', message: 'id and status required' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.update(fiscalPeriods).set({ status }).where(and(eq(fiscalPeriods.id, id), eq(fiscalPeriods.tenantId, scope.tenantId))).returning()
    if (row) {
      await writeAudit({
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: status === 'closed' ? 'period.close' : 'period.open',
        resourceType: 'fiscal_period',
        resourceId: row.id,
        after: { label: row.label, status: row.status },
      }, tx)
    }
    return Response.json({ data: row })
  })
}
