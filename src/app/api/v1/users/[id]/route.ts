import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { users } from '@/db/schema/auth'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { audit } from '@/db/repo/audit'

const Patch = z.object({
  fullName: z.string().max(200).optional(),
  role: z.enum([
    'SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF',
    'SALES', 'AUDITOR', 'USER', 'GUEST', 'VIEWER',
  ]).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  if (scope.role !== 'ADMIN' && scope.role !== 'SUPER_ADMIN') {
    return err({ code: 'FORBIDDEN', message: 'Admin only' }, 403)
  }
  const parsed = Patch.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }
  const [row] = await db
    .update(users)
    .set(parsed.data)
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    .returning()
  if (!row) return err({ code: 'NOT_FOUND', message: 'User not found' }, 404)
  await audit(scope, { action: 'user.update', resourceType: 'user', resourceId: id, after: parsed.data })
  return ok(row)
}

// U7 / R1: disabling a user is a deactivation, never a delete.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  if (scope.role !== 'ADMIN' && scope.role !== 'SUPER_ADMIN') {
    return err({ code: 'FORBIDDEN', message: 'Admin only' }, 403)
  }
  const [row] = await db
    .update(users)
    .set({ active: false })
    .where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
    .returning()
  if (!row) return err({ code: 'NOT_FOUND', message: 'User not found' }, 404)
  await audit(scope, { action: 'user.deactivate', resourceType: 'user', resourceId: id })
  return ok(row)
}
