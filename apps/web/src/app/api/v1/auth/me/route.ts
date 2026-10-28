import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { tenants, users } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        active: users.active,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(users)
      .innerJoin(tenants, eq(tenants.id, users.tenantId))
      .where(and(eq(users.id, scope.userId), eq(users.tenantId, scope.tenantId)))

    if (!row) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })
    return Response.json({ data: row })
  })
}
