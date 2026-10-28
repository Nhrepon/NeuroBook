import { NextRequest } from 'next/server'
import { sessions, tenants, users } from '@/db/schema'
import { requirePermission, forbiddenResponse, type RequestScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { db } from '@/db/client'
import { writeAudit } from '@/lib/audit'
import { ROLES, can } from '@neurobook/shared'
import { and, eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { z } from 'zod'

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES),
})

export async function GET() {
  let scope
  try {
    scope = await requirePermission('user:manage')
  } catch {
    return forbiddenResponse()
  }

  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, scope.tenantId))
    return Response.json({ data: rows })
  })
}

export async function POST(req: NextRequest) {
  let scope
  try {
    scope = await requirePermission('user:manage')
  } catch {
    return forbiddenResponse()
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'valid email, password (8+ chars) and role are required' } },
      { status: 400 },
    )
  }

  const email = parsed.data.email.trim().toLowerCase()
  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, scope.tenantId), eq(users.email, email)))
    if (existing) {
      return Response.json({ error: { code: 'CONFLICT', message: 'a user with this email already exists' } }, { status: 409 })
    }

    const [user] = await tx
      .insert(users)
      .values({ tenantId: scope.tenantId, email, passwordHash, role: parsed.data.role })
      .returning({ id: users.id, email: users.email, role: users.role, active: users.active, createdAt: users.createdAt })

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'user.create',
      resourceType: 'user',
      resourceId: user.id,
      after: { email: user.email, role: user.role },
    }, tx)

    return Response.json({ data: user }, { status: 201 })
  })
}

const PatchSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  /** Admin only: move this person's membership to another company. */
  tenantId: z.string().uuid().optional(),
})

/**
 * Moves a membership to another company. Cross-tenant by definition, so this runs
 * on the owner connection with explicit checks instead of RLS (which would reject
 * writing a row into a tenant the request is not scoped to).
 */
async function moveUser(scope: RequestScope, id: string, targetTenantId: string) {
  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role, active: users.active })
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
  if (!target) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

  if (target.id === scope.userId) {
    return Response.json({ error: { code: 'CONFLICT', message: 'you cannot move yourself to another company' } }, { status: 409 })
  }

  const [destination] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, targetTenantId))
  if (!destination) {
    return Response.json({ error: { code: 'NOT_FOUND', message: 'company not found' } }, { status: 404 })
  }

  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, destination.id), eq(users.email, target.email)))
  if (clash) {
    return Response.json(
      { error: { code: 'CONFLICT', message: `${target.email} already belongs to ${destination.slug}` } },
      { status: 409 },
    )
  }

  if (target.role === 'ADMIN' && target.active) {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
    if (admins.length <= 1) {
      return Response.json({ error: { code: 'CONFLICT', message: 'at least one active admin is required' } }, { status: 409 })
    }
  }

  const [moved] = await db
    .update(users)
    .set({ tenantId: destination.id, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    .returning({ id: users.id, email: users.email, role: users.role, active: users.active })
  if (!moved) {
    return Response.json(
      { error: { code: 'CONFLICT', message: 'the user changed while you were editing; retry' } },
      { status: 409 },
    )
  }

  // Their current session belongs to the old company, so force a fresh sign-in.
  await db.delete(sessions).where(eq(sessions.userId, id))

  await writeAudit({
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: 'user.move',
    resourceType: 'user',
    resourceId: id,
    before: { tenantId: scope.tenantId },
    after: { email: moved.email, tenantId: destination.id, slug: destination.slug },
  })

  return Response.json({ data: { ...moved, tenant: destination } })
}

export async function PATCH(req: NextRequest) {
  let scope
  try {
    scope = await requirePermission('user:manage')
  } catch {
    return forbiddenResponse()
  }

  const body = await req.json().catch(() => null)
  const id = body?.id
  const parsed = PatchSchema.safeParse(body)
  const changes =
    parsed.success &&
    (parsed.data.role !== undefined ||
      parsed.data.active !== undefined ||
      parsed.data.password !== undefined ||
      parsed.data.tenantId !== undefined)
  if (!id || !parsed.success || !changes) {
    return Response.json({ error: { code: 'VALIDATION', message: 'id and at least one change are required' } }, { status: 400 })
  }

  if (parsed.data.tenantId && parsed.data.tenantId !== scope.tenantId) {
    // Moving between companies is a tenant-management action, not a user one.
    if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()
    return moveUser(scope, id, parsed.data.tenantId)
  }

  const passwordHash = parsed.data.password
    ? await argon2.hash(parsed.data.password, { type: argon2.argon2id })
    : undefined

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    if (!target) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

    if (target.id === scope.userId && (parsed.data.role !== undefined || parsed.data.active === false)) {
      return Response.json(
        { error: { code: 'CONFLICT', message: 'you cannot change your own role or deactivate yourself' } },
        { status: 409 },
      )
    }

    if (target.role === 'ADMIN' && (parsed.data.role !== 'ADMIN' || parsed.data.active === false)) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
      if (admins.length <= 1) {
        return Response.json({ error: { code: 'CONFLICT', message: 'at least one active admin is required' } }, { status: 409 })
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.role) patch.role = parsed.data.role
    if (parsed.data.active !== undefined) patch.active = parsed.data.active
    if (passwordHash) patch.passwordHash = passwordHash

    const [user] = await tx
      .update(users)
      .set(patch)
      .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
      .returning({ id: users.id, email: users.email, role: users.role, active: users.active })

    if (passwordHash) await tx.delete(sessions).where(eq(sessions.userId, id))

    const onlyPassword =
      Boolean(passwordHash) && parsed.data.role === undefined && parsed.data.active === undefined

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: onlyPassword ? 'user.password_reset' : 'user.update',
      resourceType: 'user',
      resourceId: id,
      before: { role: target.role, active: target.active },
      after: { role: user.role, active: user.active },
    }, tx)

    return Response.json({ data: user })
  })
}

/** Removes a membership. The person may still exist in other companies. */
export async function DELETE(req: NextRequest) {
  let scope
  try {
    scope = await requirePermission('user:manage')
  } catch {
    return forbiddenResponse()
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: { code: 'VALIDATION', message: 'id is required' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select({ id: users.id, email: users.email, role: users.role, active: users.active })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    if (!target) return Response.json({ error: { code: 'NOT_FOUND', message: 'user not found' } }, { status: 404 })

    if (target.id === scope.userId) {
      return Response.json({ error: { code: 'CONFLICT', message: 'you cannot remove yourself' } }, { status: 409 })
    }

    if (target.role === 'ADMIN' && target.active) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
      if (admins.length <= 1) {
        return Response.json({ error: { code: 'CONFLICT', message: 'at least one active admin is required' } }, { status: 409 })
      }
    }

    await tx.delete(users).where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'user.delete',
      resourceType: 'user',
      resourceId: id,
      before: { email: target.email, role: target.role, active: target.active },
    }, tx)

    return Response.json({ data: { id, email: target.email } })
  })
}