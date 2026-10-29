import { db } from '@/lib/db/client'
import { companySettings, tenants, users } from '@/lib/db/schema'
import { ensureDefaultChart } from '@/lib/db/chart'
import { requirePermission } from '@/controllers/scope'
import { badRequest, notFound, conflict } from '@/controllers/errors'
import { uniqueSlug } from '@/lib/slug'
import { sessionProfile } from '@/lib/db/tenant-membership'
import { writeAudit } from '@/lib/db/audit'
import argon2 from 'argon2'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(2),
  /** Company code; derived from the name when left out. */
  slug: z.string().optional(),
  /** The company password; a company nobody can enter is a dead row. */
  password: z.string().min(8),
  /** Also add the creating admin as an ADMIN member of the new company. */
  join: z.boolean().optional().default(true),
})

const PasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8),
})

/**
 * The companies this admin belongs to. Scoped to the acting admin's own
 * memberships — a company its email has no row in is not listed.
 */
export async function getAllTenants() {
  const scope = await requirePermission('tenant:manage')
  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      passwordHash: tenants.passwordHash,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .innerJoin(users, and(eq(users.tenantId, tenants.id), eq(users.email, me.email), eq(users.active, true)))
    .orderBy(tenants.name)

  const members = await db
    .select({ tenantId: users.tenantId, members: count() })
    .from(users)
    .groupBy(users.tenantId)
  const memberCount = new Map(members.map((m) => [m.tenantId, Number(m.members)]))

  return rows.map(({ passwordHash, ...row }) => ({
    ...row,
    /** One password per company; false means nobody can switch into it yet. */
    passwordSet: Boolean(passwordHash),
    members: memberCount.get(row.id) ?? 0,
    current: row.id === scope.tenantId,
  }))
}

/**
 * Creates a company. Runs on the owner connection because the new tenant has no
 * context to scope to yet. The creator is added as the company's first ADMIN
 * member (`join`, default true).
 */
export async function createTenant(input: unknown) {
  const scope = await requirePermission('tenant:manage')
  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')

  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) {
    throw badRequest('company name (2+ chars) and a company password (8+ chars) are required')
  }

  const name = parsed.data.name.trim()
  const slug = await uniqueSlug(parsed.data.slug?.trim() || name)
  const companyPasswordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })

  const [creator] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, scope.userId))
  if (!creator) throw notFound('user not found')

  const created = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name, slug, passwordHash: companyPasswordHash })
      .returning()

    await tx.insert(companySettings).values({ tenantId: tenant.id, companyName: name })
    await ensureDefaultChart(tenant.id, tx as any)

    let membership: { id: string; email: string; role: string } | null = null
    if (parsed.data.join) {
      // Same person, same login password: the membership copies the hash the
      // creator already authenticates with, so signing in does not change.
      const [user] = await tx
        .insert(users)
        .values({ tenantId: tenant.id, email: creator.email, passwordHash: creator.passwordHash, role: 'ADMIN' })
        .returning({ id: users.id, email: users.email, role: users.role })
      membership = user
    }

    await writeAudit(
      {
        tenantId: tenant.id,
        userId: scope.userId,
        action: 'tenant.create',
        resourceType: 'tenant',
        resourceId: tenant.id,
        after: { name: tenant.name, slug: tenant.slug, joined: Boolean(membership) },
      },
      tx as any,
    )

    return { tenant, membership }
  })

  return {
    id: created.tenant.id,
    name: created.tenant.name,
    slug: created.tenant.slug,
    membership: created.membership,
  }
}

/**
 * Sets the company password of one of the acting admin's companies, without
 * entering it first. No current password is asked for — the point is that an
 * admin can rotate a company whose password is unknown or lost.
 */
export async function updateTenantPassword(input: unknown) {
  const scope = await requirePermission('tenant:manage')
  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')

  const parsed = PasswordSchema.safeParse(input)
  if (!parsed.success) throw badRequest('id and a password of at least 8 characters are required')

  const [target] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, passwordHash: tenants.passwordHash })
    .from(tenants)
    .innerJoin(users, and(eq(users.tenantId, tenants.id), eq(users.email, me.email), eq(users.active, true)))
    .where(eq(tenants.id, parsed.data.id))
  if (!target) throw notFound('company not found')

  const hash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })
  await db
    .update(tenants)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(tenants.id, target.id))

  await writeAudit({
    tenantId: target.id,
    userId: scope.userId,
    action: 'tenant.password_change',
    resourceType: 'tenant',
    resourceId: target.id,
    before: { hadPassword: Boolean(target.passwordHash) },
    after: { hadPassword: true, slug: target.slug, by: 'admin' },
  })

  return { id: target.id, slug: target.slug, passwordSet: true }
}

/**
 * Deletes a company and everything scoped to it (ON DELETE CASCADE). Refuses when
 * the admin's email belongs only to this company, because their sign-in would
 * disappear with it. `sessionEnded` tells the route whether to clear the cookie.
 */
export async function deleteTenant(id: string) {
  const scope = await requirePermission('tenant:manage')
  if (!id) throw badRequest('id is required')

  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')

  const [target] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, id))
  if (!target) throw notFound('company not found')

  const mine = await db
    .select({ id: users.id, tenantId: users.tenantId })
    .from(users)
    .where(and(eq(users.email, me.email), eq(users.active, true)))
  const myTenants = mine.map((m) => m.tenantId)

  if (!myTenants.includes(target.id)) throw notFound('company not found')

  if (myTenants.length <= 1) {
    throw conflict(
      `${target.name} is the only company your email belongs to — deleting it would leave you unable to sign in.`,
    )
  }

  const [memberCount] = await db.select({ members: count() }).from(users).where(eq(users.tenantId, id))
  const members = Number(memberCount?.members ?? 0)
  const sessionEnded = id === scope.tenantId
  // Keep the trail where the admin can still read it, and point the entry at the
  // admin's user row *there*: the row the session is using is deleted along with
  // the company, and an audit row may not reference a user that no longer exists.
  const auditTenantId = myTenants.find((t) => t !== id) ?? scope.tenantId
  const auditUserId = mine.find((m) => m.tenantId === auditTenantId)?.id ?? null

  await db.transaction(async (tx) => {
    await tx.delete(tenants).where(eq(tenants.id, id))
    await writeAudit(
      {
        tenantId: auditTenantId,
        userId: auditUserId,
        action: 'tenant.delete',
        resourceType: 'tenant',
        resourceId: id,
        before: { id, name: target.name, slug: target.slug, members, fromTenantId: scope.tenantId },
      },
      tx as any,
    )
  })

  return { ...target, members, sessionEnded }
}
