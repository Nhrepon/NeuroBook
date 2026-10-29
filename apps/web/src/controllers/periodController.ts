import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { fiscalPeriods } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const Schema = z.object({
  label: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['open', 'closed']).optional(),
})

const PatchSchema = z.object({ id: z.string().uuid(), status: z.enum(['open', 'closed']) })

export async function getAllPeriods() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(fiscalPeriods).where(eq(fiscalPeriods.tenantId, scope.tenantId)),
  )
}

export async function createPeriod(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(fiscalPeriods)
      .values({
        tenantId: scope.tenantId,
        label: parsed.data.label,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        status: parsed.data.status ?? 'open',
      })
      .returning()
    return row
  })
}

export async function updatePeriod(input: unknown) {
  const scope = await requireScope()
  const parsed = PatchSchema.safeParse(input)
  if (!parsed.success) throw badRequest('id and status required')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .update(fiscalPeriods)
      .set({ status: parsed.data.status })
      .where(and(eq(fiscalPeriods.id, parsed.data.id), eq(fiscalPeriods.tenantId, scope.tenantId)))
      .returning()
    if (row) {
      await writeAudit(
        {
          tenantId: scope.tenantId,
          userId: scope.userId,
          action: parsed.data.status === 'closed' ? 'period.close' : 'period.open',
          resourceType: 'fiscal_period',
          resourceId: row.id,
          after: { label: row.label, status: row.status },
        },
        tx,
      )
    }
    return row
  })
}