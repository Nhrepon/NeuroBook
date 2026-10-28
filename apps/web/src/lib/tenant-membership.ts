import { db } from '@/db/client'
import { tenants, users } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { can } from '@neurobook/shared'
import type { RequestScope } from '@/db/scope'

export interface SwitchCompany {
  id: string
  name: string
  slug: string
  /** The role this session would hold in that company. */
  role: string
  /** False when an ADMIN is being offered a company it does not belong to. */
  member: boolean
  current: boolean
}

export interface SessionProfile {
  id: string
  email: string
  role: string
  active: boolean
  tenantId: string
  tenantName: string
  tenantSlug: string
  /** False when an ADMIN is visiting a company it does not belong to. */
  member: boolean
}

/**
 * The profile behind the current scope: who is signed in and which company the
 * session is bound to.
 *
 * The user row and the tenant are read separately on the owner connection:
 * `scope.tenantId` may be a company the user is only visiting (ADMIN), in which
 * case the row lives in another tenant and RLS would hide it from a scoped read.
 */
export async function sessionProfile(scope: RequestScope): Promise<SessionProfile | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role, active: users.active, tenantId: users.tenantId })
    .from(users)
    .where(and(eq(users.id, scope.userId), eq(users.active, true)))
  if (!user) return null

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId))
  if (!tenant) return null

  // Outside their own company a visitor carries the role from the token, not the
  // role of the membership row that lives in their home tenant.
  const member = user.tenantId === tenant.id
  const role = member ? user.role : scope.role

  return {
    id: user.id,
    email: user.email,
    role,
    active: user.active,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    member,
  }
}

/**
 * Companies the switch dialog may offer.
 *
 * Everyone gets the companies their email belongs to. An ADMIN (`tenant:manage`)
 * also gets every other company on the server, marked `member: false` — it may
 * enter one with that company's password, without gaining a membership row.
 */
export async function listSwitchableCompanies(scope: RequestScope, email: string): Promise<SwitchCompany[]> {
  const memberships = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, role: users.role })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), eq(users.active, true)))

  const merged = new Map<string, SwitchCompany>(
    memberships.map((row) => [row.id, { ...row, member: true, current: row.id === scope.tenantId }]),
  )

  if (can(scope.role, 'tenant:manage')) {
    const all = await db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug }).from(tenants)
    for (const tenant of all) {
      if (merged.has(tenant.id)) continue
      merged.set(tenant.id, {
        ...tenant,
        role: scope.role,
        member: false,
        current: tenant.id === scope.tenantId,
      })
    }
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface SwitchTarget {
  /** The user row the new session is signed as. */
  userId: string
  /** The role that session holds in the target company. */
  role: string
  tenantId: string
  slug: string
  tenantName: string
  tenantPasswordHash: string | null
  member: boolean
}

/**
 * Resolves where a switch may go.
 *
 * The membership row wins when it exists, so someone who really belongs to a
 * company keeps the role assigned there. Otherwise an ADMIN may reach any
 * company by code; returning null for everyone else keeps the failure opaque,
 * so a non-member cannot tell a wrong password from a company they cannot see.
 */
export async function findSwitchTarget(
  scope: RequestScope,
  email: string,
  slug: string,
): Promise<SwitchTarget | null> {
  const [row] = await db
    .select({
      user: users,
      slug: tenants.slug,
      tenantName: tenants.name,
      tenantPasswordHash: tenants.passwordHash,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), eq(users.active, true), eq(tenants.slug, slug)))

  if (row) {
    return {
      userId: row.user.id,
      role: row.user.role,
      tenantId: row.user.tenantId,
      slug: row.slug,
      tenantName: row.tenantName,
      tenantPasswordHash: row.tenantPasswordHash,
      member: true,
    }
  }

  if (!can(scope.role, 'tenant:manage')) return null

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, passwordHash: tenants.passwordHash })
    .from(tenants)
    .where(eq(tenants.slug, slug))
  if (!tenant) return null

  return {
    userId: scope.userId,
    role: scope.role,
    tenantId: tenant.id,
    slug: tenant.slug,
    tenantName: tenant.name,
    tenantPasswordHash: tenant.passwordHash,
    member: false,
  }
}
