import { db } from '@/lib/db/client'
import { companySettings, tenants, users } from '@/lib/db/schema'
import { ensureDefaultChart } from '@/lib/db/chart'
import { ensureDefaultTaxRates } from '@/lib/db/tax-seed'
import { requirePermission, requireScope } from '@/controllers/scope'
import { ApiError, badRequest, conflict, notFound } from '@/controllers/errors'
import { findSwitchTarget, listSwitchableCompanies, sessionProfile } from '@/lib/db/tenant-membership'
import { uniqueSlug } from '@/lib/slug'
import { signToken } from '@/lib/jwt'
import { verifyPassword } from '@/lib/credentials'
import { writeAudit } from '@/lib/db/audit'
import { withTenant } from '@/lib/db/tenant'
import argon2 from 'argon2'
import { and, eq } from 'drizzle-orm'

/**
 * Signs a person in. When their email belongs to more than one company and no
 * company code is supplied, the caller must pick one (409 `COMPANY_REQUIRED`).
 */
export async function login(input: unknown) {
  const body = (input ?? {}) as { email?: unknown; password?: unknown; company?: unknown }
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body.password ?? '')
  const company = body.company ? String(body.company).trim().toLowerCase() : undefined

  if (!email || !password) throw badRequest('email and password required')

  const candidates = await db
    .select({ user: users, slug: tenants.slug, tenantName: tenants.name, status: tenants.status })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(eq(users.email, email))

  // A suspended or archived company is not enterable, even by its own members.
  let matches = candidates.filter((c) => c.user.active && c.status === 'active')
  if (company) matches = matches.filter((c) => c.slug === company)

  if (matches.length > 1 && !company) {
    throw new ApiError(
      409,
      'COMPANY_REQUIRED',
      'This email belongs to more than one company. Enter your company code.',
    )
  }

  const match = matches[0]
  const ok = await verifyPassword(password, match?.user.passwordHash)
  if (!match || !ok) throw new ApiError(401, 'UNAUTHORIZED', 'invalid credentials')

  const user = match.user
  const token = await signToken({ sub: user.id, tid: user.tenantId, role: user.role, ver: user.tokenVersion })

  void writeAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: 'auth.login',
    resourceType: 'user',
    resourceId: user.id,
  }).catch(() => {})

  return {
    accessToken: token,
    user: { id: user.id, email: user.email, role: user.role },
    tenant: { slug: match.slug, name: match.tenantName },
  }
}

export async function logout() {
  return { revoked: true }
}

/**
 * The session's own profile: who is signed in and which company the request is
 * bound to. Read from the tenant in the token rather than the user's home row, so
 * an ADMIN visiting another company sees that company, not its own.
 */
export async function getMe() {
  const scope = await requireScope()
  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')
  return me
}

/**
 * Deletes the signed-in person's own account in the current company.
 *
 * This removes their membership row — the one this session is signed as — not
 * the company. Another company the same email belongs to is untouched, and the
 * caller's session ends because the user row it points at is gone. The last
 * active admin cannot leave, or the company would have nobody to administer it.
 */
export async function deleteMyAccount() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [me] = await tx
      .select({ id: users.id, email: users.email, role: users.role, active: users.active })
      .from(users)
      .where(and(eq(users.id, scope.userId), eq(users.tenantId, scope.tenantId)))
    if (!me) throw notFound('user not found')

    if (me.role === 'ADMIN' && me.active) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
      if (admins.length <= 1) {
        throw conflict(
          'You are the only admin of this company. Make another member an admin first — or delete the company instead.',
        )
      }
    }

    await tx.delete(users).where(and(eq(users.id, scope.userId), eq(users.tenantId, scope.tenantId)))

    // The user row is gone, so the entry cannot point at it; the email keeps the
    // trail readable and the company's admins can still see who left.
    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: null,
        action: 'user.self_delete',
        resourceType: 'user',
        resourceId: scope.userId,
        before: { email: me.email, role: me.role },
      },
      tx,
    )

    return { id: scope.userId, email: me.email, sessionEnded: true }
  })
}

/** Creates a company and its first ADMIN user, then signs that user in. */
export async function register(input: unknown) {
  const body = (input ?? {}) as {
    companyName?: unknown
    companySlug?: unknown
    email?: unknown
    password?: unknown
  }
  const companyName = String(body.companyName ?? '').trim()
  const requestedSlug = body.companySlug ? String(body.companySlug).trim() : ''
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body.password ?? '')

  if (!companyName || companyName.length < 2) throw badRequest('company name is required')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('a valid email is required')
  if (password.length < 8) throw badRequest('password must be at least 8 characters')

  const slug = await uniqueSlug(requestedSlug || companyName)
  const hash = await argon2.hash(password, { type: argon2.argon2id })

  const { tenant, user } = await db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values({ name: companyName, slug, tenantCode: slug.toUpperCase(), passwordHash: hash }).returning()
    const [user] = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email,
        passwordHash: hash,
        role: 'ADMIN',
      })
      .returning()

    // Seed the company profile so Settings opens with the registered name
    // instead of an empty form (which would later blank out `tenants.name`).
    await tx.insert(companySettings).values({ tenantId: tenant.id, companyName })

    await ensureDefaultChart(tenant.id, tx as any)
    await ensureDefaultTaxRates(tenant.id, tx as any)

    await writeAudit(
      {
        tenantId: tenant.id,
        userId: user.id,
        action: 'tenant.create',
        resourceType: 'tenant',
        resourceId: tenant.id,
        after: { name: tenant.name, slug: tenant.slug },
      },
      tx as any,
    )

    return { tenant, user }
  })

  const token = await signToken({ sub: user.id, tid: tenant.id, role: user.role, ver: user.tokenVersion })

  return {
    accessToken: token,
    user: { id: user.id, email: user.email, role: user.role },
    tenant: { slug: tenant.slug, name: tenant.name },
  }
}

/**
 * Moves the session to another company.
 *
 * The password checked here is the **company** password, not the person's login
 * password: it belongs to the tenant and is shared by whoever belongs to it.
 *
 * A session may only move into a company the signed-in email is a member of, so
 * a company password alone can never open a company you do not belong to.
 */
export async function switchTenant(input: unknown) {
  const scope = await requirePermission('tenant:switch')

  const body = (input ?? {}) as { tenantSlug?: unknown; password?: unknown }
  const slug = String(body.tenantSlug ?? '')
    .trim()
    .toLowerCase()
  const password = String(body.password ?? '')

  if (!slug || !password) throw badRequest('tenantSlug and password required')

  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')

  const target = await findSwitchTarget(me.email, slug)
  if (!target) {
    throw new ApiError(401, 'UNAUTHORIZED', 'This company password does not match, or you are not a member.')
  }

  if (target.tenantId === scope.tenantId) {
    throw new ApiError(409, 'ALREADY_IN_TENANT', 'This company is already selected.')
  }

  if (!target.tenantPasswordHash) {
    throw new ApiError(
      409,
      'TENANT_PASSWORD_REQUIRED',
      'This company has no company password yet. Its admin has to set one in Settings.',
    )
  }

  if (!(await verifyPassword(password, target.tenantPasswordHash))) {
    throw new ApiError(401, 'UNAUTHORIZED', 'This company password does not match, or you are not a member.')
  }

  const token = await signToken({
    sub: target.userId,
    tid: target.tenantId,
    role: target.role,
    ver: target.tokenVersion,
  })

  void writeAudit({
    tenantId: target.tenantId,
    userId: target.userId,
    action: 'auth.tenant_switch',
    resourceType: 'tenant',
    resourceId: target.tenantId,
    before: { tenantId: scope.tenantId },
    after: { tenantId: target.tenantId, slug: target.slug, via: 'company-password', as: 'member' },
  }).catch(() => {})

  return {
    accessToken: token,
    user: { id: target.userId, email: me.email, role: target.role },
    tenant: { slug: target.slug, name: target.tenantName },
    membership: true,
  }
}

/**
 * Companies the switch dialog may offer. Only roles that may actually switch
 * (ADMIN, MANAGER) can read the list. Scoped to companies where the signed-in
 * email has a membership row.
 */
export async function getSwitchableTenants() {
  const scope = await requirePermission('tenant:switch')
  const me = await sessionProfile(scope)
  if (!me) throw notFound('user not found')
  return listSwitchableCompanies(scope, me.email)
}
