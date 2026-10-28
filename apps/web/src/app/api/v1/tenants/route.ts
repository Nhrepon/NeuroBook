import { db } from '@/db/client'
import { tenants } from '@/db/schema'
import { can } from '@neurobook/shared'
import { forbiddenResponse, requireScope } from '@/db/scope'

/**
 * Every company on this server, for the admin "move user to another company"
 * control. Owner connection: the list spans tenants, which RLS hides.
 */
export async function GET() {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const rows = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .orderBy(tenants.name)

  return Response.json({ data: rows.map((row) => ({ ...row, current: row.id === scope.tenantId })) })
}