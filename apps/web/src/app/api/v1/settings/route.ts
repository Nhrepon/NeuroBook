import { NextRequest } from 'next/server'
import { companySettings } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({
  companyName: z.string().min(1),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  currency: z.string().optional(),
})

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))
    return Response.json({ data: row ?? null })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))
    if (existing) {
      const [row] = await tx.update(companySettings).set({ ...parsed.data, updatedAt: new Date() }).where(eq(companySettings.tenantId, scope.tenantId)).returning()
      await writeAudit({
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'settings.update',
        resourceType: 'company_settings',
        resourceId: row.id,
        before: existing,
        after: row,
      }, tx)
      return Response.json({ data: row })
    }
    const [row] = await tx.insert(companySettings).values({ tenantId: scope.tenantId, ...parsed.data }).returning()
    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'settings.create',
      resourceType: 'company_settings',
      resourceId: row.id,
      after: row,
    }, tx)
    return Response.json({ data: row }, { status: 201 })
  })
}
