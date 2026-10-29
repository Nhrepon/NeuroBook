import { desc, eq } from 'drizzle-orm'
import { auditLog, tenants, users } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'

export async function getAuditLog() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        before: auditLog.before,
        after: auditLog.after,
        ip: auditLog.ip,
        actorRole: auditLog.actorRole,
        userAgent: auditLog.userAgent,
        route: auditLog.route,
        createdAt: auditLog.createdAt,
        userEmail: users.email,
        userRole: users.role,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(eq(auditLog.tenantId, scope.tenantId))
      .orderBy(desc(auditLog.createdAt))
      .limit(500)

    const [company] = await tx
      .select({ name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))

    return { data: rows, meta: { company: company ?? null, viewer: { role: scope.role } } }
  })
}