import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { companySettings, tenants, users } from '@/db/schema'
import { ensureDefaultChart } from '@/db/chart'
import { can } from '@neurobook/shared'
import { forbiddenResponse, requireScope } from '@/db/scope'
import { uniqueSlug } from '@/lib/slug'
import { sessionProfile } from '@/lib/tenant-membership'
import { writeAudit } from '@/lib/audit'
import argon2 from 'argon2'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * Every company on this server: the admin company list, the "move user to another
 * company" control and the create-company form. Owner connection: the list spans
 * tenants, which RLS hides. ADMIN only (`tenant:manage`).
 */
export async function GET() {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      passwordHash: tenants.passwordHash,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(tenants.name)

  const members = await db
    .select({ tenantId: users.tenantId, members: count() })
    .from(users)
    .groupBy(users.tenantId)
  const memberCount = new Map(members.map((m) => [m.tenantId, Number(m.members)]))

  return Response.json({
    data: rows.map(({ passwordHash, ...row }) => ({
      ...row,
      /** One password per company; false means nobody can switch into it yet. */
      passwordSet: Boolean(passwordHash),
      members: memberCount.get(row.id) ?? 0,
      current: row.id === scope.tenantId,
    })),
  })
}

const CreateSchema = z.object({
  name: z.string().min(2),
  /** Company code; derived from the name when left out. */
  slug: z.string().optional(),
  /**
   * The company password. Required: a company nobody can enter is a dead row,
   * and only an admin already inside can set one later.
   */
  password: z.string().min(8),
  /**
   * Also add the creating admin as an ADMIN member of the new company. Defaults
   * to true: whoever creates a company becomes its first admin.
   */
  join: z.boolean().optional().default(true),
})

/**
 * Creates a company. ADMIN only (`tenant:manage`).
 *
 * Runs on the owner connection because the new tenant has no context to scope to
 * yet — the same reason registration does. The creator is added as the company's
 * first ADMIN member (`join`, default true), so it can open the company straight
 * away and staff it from Users &amp; roles; pass `join: false` to create a company
 * with no members.
 */
export async function POST(req: NextRequest) {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const me = await sessionProfile(scope)
  if (!me) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'company name (2+ chars) and a company password (8+ chars) are required' } },
      { status: 400 },
    )
  }

  const name = parsed.data.name.trim()
  const slug = await uniqueSlug(parsed.data.slug?.trim() || name)
  const companyPasswordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })

  const [creator] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, scope.userId))
  if (!creator) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

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

  return Response.json(
    {
      data: {
        id: created.tenant.id,
        name: created.tenant.name,
        slug: created.tenant.slug,
        membership: created.membership,
      },
    },
    { status: 201 },
  )
}

const PasswordSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(8),
})

/**
 * Sets the company password of **any** company, without entering it first.
 *
 * One company has exactly one password and every person who switches into it
 * uses that one, so this single write changes what all of its users must type.
 * ADMIN only, and no current password is asked for: the point of this route is
 * that an operator can rotate a company whose password is unknown or lost. Users
 * already switched in keep their session until the token expires.
 */
export async function PATCH(req: NextRequest) {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const body = await req.json().catch(() => null)
  const parsed = PasswordSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'id and a password of at least 8 characters are required' } },
      { status: 400 },
    )
  }

  const [target] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, passwordHash: tenants.passwordHash })
    .from(tenants)
    .where(eq(tenants.id, parsed.data.id))
  if (!target) return Response.json({ error: { code: 'NOT_FOUND', message: 'company not found' } }, { status: 404 })

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

  return Response.json({ data: { id: target.id, slug: target.slug, passwordSet: true } })
}

/**
 * Deletes a company and everything scoped to it. ADMIN only (`tenant:manage`).
 *
 * Every tenant-scoped table (`accounts`, `vouchers`, `journal_lines`, `invoices`,
 * `payments`, `parties`, `products`, `stock_movements`, `users`, `audit_log`, …)
 * references `tenants(id)` with `ON DELETE CASCADE`, so removing the tenant row
 * removes all of that company's data in one statement.
 *
 * Two safety rules:
 *  - the deletion is refused when the acting admin's email belongs to this company
 *    and to no other, because their sign-in would disappear with it;
 *  - deleting the company the session is currently in ends that session, so the
 *    cookie is cleared and the caller has to pick another company at sign-in.
 *
 * The audit entry is written into a company the admin still belongs to, so the
 * record outlives the company it describes.
 */
export async function DELETE(req: NextRequest) {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return Response.json({ error: { code: 'VALIDATION', message: 'id is required' } }, { status: 400 })

  const me = await sessionProfile(scope)
  if (!me) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

  const [target] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, id))
  if (!target) return Response.json({ error: { code: 'NOT_FOUND', message: 'company not found' } }, { status: 404 })

  const mine = await db
    .select({ id: users.id, tenantId: users.tenantId })
    .from(users)
    .where(and(eq(users.email, me.email), eq(users.active, true)))
  const myTenants = mine.map((m) => m.tenantId)

  if (myTenants.includes(target.id) && myTenants.length <= 1) {
    return Response.json(
      {
        error: {
          code: 'CONFLICT',
          message: `${target.name} is the only company your email belongs to — deleting it would leave you unable to sign in.`,
        },
      },
      { status: 409 },
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

  const res = Response.json({ data: { ...target, members, sessionEnded } })
  if (sessionEnded) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.headers.set('Set-Cookie', `access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
  }
  return res
}
