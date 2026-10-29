import { and, eq, sql } from 'drizzle-orm'
import argon2 from 'argon2'
import { z } from 'zod'
import { tenants, users } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { db } from '@/lib/db/client'
import { writeAudit } from '@/lib/db/audit'
import { ROLES, can } from '@neurobook/shared'
import { ForbiddenError, requirePermission, type RequestScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES),
})

const PatchSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  tenantId: z.string().uuid().optional(),
})

export async function getAllUsers() {
  const scope = await requirePermission('user:manage')
  return withTenant(scope.tenantId, async (tx) =>
    tx
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, scope.tenantId)),
  )
}

export async function createUser(input: unknown) {
  const scope = await requirePermission('user:manage')
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('valid email, password (8+ chars) and role are required')

  const email = parsed.data.email.trim().toLowerCase()
  const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id })

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, scope.tenantId), eq(users.email, email)))
    if (existing) throw conflict('a user with this email already exists')

    const [user] = await tx
      .insert(users)
      .values({ tenantId: scope.tenantId, email, passwordHash, role: parsed.data.role })
      .returning({ id: users.id, email: users.email, role: users.role, active: users.active, createdAt: users.createdAt })

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'user.create',
        resourceType: 'user',
        resourceId: user.id,
        after: { email: user.email, role: user.role },
      },
      tx,
    )

    return user
  })
}

async function moveUser(scope: RequestScope, id: string, targetTenantId: string) {
  const [target] = await db
    .select({ id: users.id, email: users.email, role: users.role, active: users.active })
    .from(users)
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
  if (!target) throw notFound('user not found')
  if (target.id === scope.userId) throw conflict('you cannot move yourself to another company')

  const [destination] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, targetTenantId))
  if (!destination) throw notFound('company not found')

  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, destination.id), eq(users.email, target.email)))
  if (clash) throw conflict(`${target.email} already belongs to ${destination.slug}`)

  if (target.role === 'ADMIN' && target.active) {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
    if (admins.length <= 1) throw conflict('at least one active admin is required')
  }

  const [moved] = await db
    .update(users)
    .set({ tenantId: destination.id, updatedAt: new Date(), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    .returning({ id: users.id, email: users.email, role: users.role, active: users.active })
  if (!moved) throw conflict('the user changed while you were editing; retry')

  await writeAudit({
    tenantId: scope.tenantId,
    userId: scope.userId,
    action: 'user.move',
    resourceType: 'user',
    resourceId: id,
    before: { tenantId: scope.tenantId },
    after: { email: moved.email, tenantId: destination.id, slug: destination.slug },
  })

  return { ...moved, tenant: destination }
}

export async function updateUser(input: unknown) {
  const scope = await requirePermission('user:manage')
  const parsed = PatchSchema.safeParse(input)
  const id = (input as any)?.id
  const changes =
    parsed.success &&
    (parsed.data.role !== undefined ||
      parsed.data.active !== undefined ||
      parsed.data.password !== undefined ||
      parsed.data.tenantId !== undefined)
  if (!id || !parsed.success || !changes) throw badRequest('id and at least one change are required')

  if (parsed.data.tenantId && parsed.data.tenantId !== scope.tenantId) {
    if (!can(scope.role, 'tenant:manage')) throw new ForbiddenError()
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
    if (!target) throw notFound('user not found')

    if (target.id === scope.userId && (parsed.data.role !== undefined || parsed.data.active === false)) {
      throw conflict('you cannot change your own role or deactivate yourself')
    }

    if (target.role === 'ADMIN' && (parsed.data.role !== 'ADMIN' || parsed.data.active === false)) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
      if (admins.length <= 1) throw conflict('at least one active admin is required')
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.role) patch.role = parsed.data.role
    if (parsed.data.active !== undefined) patch.active = parsed.data.active
    if (passwordHash) patch.passwordHash = passwordHash
    if (parsed.data.role || parsed.data.active !== undefined || passwordHash) {
      patch.tokenVersion = sql`${users.tokenVersion} + 1`
    }

    const [user] = await tx
      .update(users)
      .set(patch)
      .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
      .returning({ id: users.id, email: users.email, role: users.role, active: users.active })

    const onlyPassword = Boolean(passwordHash) && parsed.data.role === undefined && parsed.data.active === undefined

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: onlyPassword ? 'user.password_reset' : 'user.update',
        resourceType: 'user',
        resourceId: id,
        before: { role: target.role, active: target.active },
        after: { role: user.role, active: user.active },
      },
      tx,
    )

    return user
  })
}

export async function deleteUser(id: string) {
  const scope = await requirePermission('user:manage')
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select({ id: users.id, email: users.email, role: users.role, active: users.active })
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    if (!target) throw notFound('user not found')
    if (target.id === scope.userId) throw conflict('you cannot remove yourself')

    if (target.role === 'ADMIN' && target.active) {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, scope.tenantId), eq(users.role, 'ADMIN'), eq(users.active, true)))
      if (admins.length <= 1) throw conflict('at least one active admin is required')
    }

    await tx.delete(users).where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'user.delete',
        resourceType: 'user',
        resourceId: id,
        before: { email: target.email, role: target.role, active: target.active },
      },
      tx,
    )

    return { id, email: target.email }
  })
}