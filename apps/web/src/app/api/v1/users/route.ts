import { NextRequest } from 'next/server'
import { users } from '@/db/schema'
import { requirePermission, forbiddenResponse } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { ROLES } from '@neurobook/shared'
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
})

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
  if (!id || !parsed.success || (!parsed.data.role && parsed.data.active === undefined && !parsed.data.password)) {
    return Response.json({ error: { code: 'VALIDATION', message: 'id and at least one change are required' } }, { status: 400 })
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

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'user.update',
      resourceType: 'user',
      resourceId: id,
      before: { role: target.role, active: target.active },
      after: { role: user.role, active: user.active },
    }, tx)

    return Response.json({ data: user })
  })
}
