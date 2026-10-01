// User CRUD (admin-only — middleware already gates by role).
import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { db } from '@/db/client'
import { users } from '@/db/schema/auth'
import { and, eq } from 'drizzle-orm'
import { hashPassword } from '@/db/repo/auth'
import { z } from 'zod'

const CreateUser = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF', 'SALES', 'AUDITOR', 'USER', 'GUEST', 'VIEWER']),
})

export async function GET() {
  const scope = await requireScope()
  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role, active: users.active, fullName: users.fullName })
    .from(users)
    .where(eq(users.tenantId, scope.tenantId))
  return ok(rows)
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  if (scope.role !== 'ADMIN' && scope.role !== 'SUPER_ADMIN') {
    return err({ code: 'FORBIDDEN', message: 'Admin only' }, 403)
  }
  const body = await req.json().catch(() => null)
  const parsed = CreateUser.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input' }, 400)
  }
  const [row] = await db
    .insert(users)
    .values({
      tenantId: scope.tenantId,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      fullName: parsed.data.fullName,
    })
    .returning({ id: users.id, email: users.email, role: users.role })
  return ok(row)
}
