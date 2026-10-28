import { auditLog, tenants, users } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { desc, eq } from 'drizzle-orm'

/**
 * Audit trail for the company the session is in, newest first.
 *
 * Every row answers *who / what / where*: the actor is joined in (email + the
 * role it held at the time), `before` / `after` say what the write changed, and
 * `ip`, `user_agent` and `route` say where the request came from and which
 * endpoint handled it. `user_id` is `SET NULL` when a user is later removed, so
 * the join is a left join and old rows may name nobody; the company name is
 * returned once in `meta` rather than repeated per row.
 */
export async function GET() {
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

    return Response.json({ data: rows, meta: { company: company ?? null, viewer: { role: scope.role } } })
  })
}
