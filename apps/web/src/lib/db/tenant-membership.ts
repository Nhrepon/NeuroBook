import { db } from '@/lib/db/client'
import { tenants, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { RequestScope } from '@/controllers/scope'

export interface SwitchCompany {
  id: string
  name: string
  slug: string
  /** The role this session would hold in that company. */
  role: string
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
}

/**
 * The profile behind the current scope: who is signed in and which company the
 * session is bound to.
 *
 * A session only ever works in a company its email is a member of — the proxy
 * refuses a token whose tenant is not the user's own row — so the user row and
 * the tenant always agree, and the role is the membership's role.
 */
export async function sessionProfile(scope: RequestScope): Promise<SessionProfile | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role, active: users.active, tenantId: users.tenantId })
    .from(users)
    .where(and(eq(users.id, scope.userId), eq(users.active, true)))
  if (!user) return null
  if (user.tenantId !== scope.tenantId) return null

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId))
  if (!tenant || tenant.status !== 'active') return null

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    active: user.active,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
  }
}

/**
 * Companies the switch dialog may offer: exactly the companies this email has an
 * active membership row in. An admin cannot see — let alone enter — a company its
 * email does not belong to.
 */
export async function listSwitchableCompanies(scope: RequestScope, email: string): Promise<SwitchCompany[]> {
  const memberships = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, role: users.role })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), eq(users.active, true), eq(tenants.status, 'active')))

  return memberships
    .map((row) => ({ ...row, current: row.id === scope.tenantId }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface SwitchTarget {
  /** The user row the new session is signed as. */
  userId: string
  /** The role that session holds in the target company. */
  role: string
  tenantId: string
  slug: string
  tenantName: string
  /** The target user's token generation, stamped into the new token. */
  tokenVersion: number
  tenantPasswordHash: string | null
}

/**
 * Resolves where a switch may go: only a company this email is an active member
 * of. Returning null in every other case keeps the failure opaque, so a
 * non-member cannot tell a wrong password from a company they cannot see.
 */
export async function findSwitchTarget(email: string, slug: string): Promise<SwitchTarget | null> {
  const [row] = await db
    .select({
      user: users,
      slug: tenants.slug,
      tenantName: tenants.name,
      tenantPasswordHash: tenants.passwordHash,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.email, email), eq(users.active, true), eq(tenants.slug, slug), eq(tenants.status, 'active')))

  if (!row) return null

  return {
    userId: row.user.id,
    role: row.user.role,
    tenantId: row.user.tenantId,
    slug: row.slug,
    tenantName: row.tenantName,
    tokenVersion: row.user.tokenVersion,
    tenantPasswordHash: row.tenantPasswordHash,
  }
}
