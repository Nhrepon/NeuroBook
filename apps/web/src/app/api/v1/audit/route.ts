import { auditLog } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { eq } from 'drizzle-orm'

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(auditLog).where(eq(auditLog.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}
