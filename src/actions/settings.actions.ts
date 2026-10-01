'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { users } from '@/db/schema/auth'
import { listPeriods, closePeriod, reopenPeriod } from '@/db/repo/fiscalPeriods'
import { requireScope } from '@/db/scope'
import { audit } from '@/db/repo/audit'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

const TenantPatch = z.object({
  name: z.string().min(1).max(200),
  bin: z.string().max(32).optional(),
  tin: z.string().max(32).optional(),
  address: z.string().max(500).optional(),
  division: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  upazila: z.string().max(100).optional(),
  union: z.string().max(100).optional(),
})

export interface TenantState {
  ok: boolean
  error?: string
}

export async function updateTenantAction(
  _prev: TenantState,
  formData: FormData,
): Promise<TenantState> {
  const scope = await requireScope()
  const parsed = TenantPatch.safeParse({
    name: formData.get('name'),
    bin: formData.get('bin') || undefined,
    tin: formData.get('tin') || undefined,
    address: formData.get('address') || undefined,
    division: formData.get('division') || undefined,
    district: formData.get('district') || undefined,
    upazila: formData.get('upazila') || undefined,
    union: formData.get('union') || undefined,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message }
  }
  await db
    .update(tenants)
    .set(parsed.data)
    .where(eq(tenants.id, scope.tenantId))
  await audit(scope, { action: 'tenant.update', resourceType: 'tenant', resourceId: scope.tenantId, after: parsed.data })
  revalidatePath('/settings')
  return { ok: true }
}

// ---- Users ----
const Role = z.enum([
  'SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF',
  'SALES', 'AUDITOR', 'USER', 'GUEST', 'VIEWER',
])

export interface UserOpState {
  ok: boolean
  error?: string
}

export async function updateUserAction(_prev: UserOpState, formData: FormData): Promise<UserOpState> {
  const scope = await requireScope()
  if (scope.role !== 'ADMIN' && scope.role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Admin only.' }
  }
  const id = formData.get('userId')?.toString()
  if (!id) return { ok: false, error: 'Missing userId' }
  const patch: Record<string, unknown> = {}
  const role = formData.get('role')?.toString()
  const active = formData.get('active')
  if (role && Role.safeParse(role).success) patch.role = role
  if (active !== null) patch.active = active === 'on'
  await db.update(users).set(patch as object).where(and(eq(users.id, id), eq(users.tenantId, scope.tenantId)))
  await audit(scope, { action: 'user.update', resourceType: 'user', resourceId: id, after: patch })
  revalidatePath('/settings')
  return { ok: true }
}

// ---- Periods ----
export interface PeriodOpState {
  ok: boolean
  error?: string
}

export async function closePeriodAction(_prev: PeriodOpState, formData: FormData): Promise<PeriodOpState> {
  const scope = await requireScope()
  const label = formData.get('label')?.toString()
  if (!label) return { ok: false, error: 'Missing label' }
  try {
    const row = await closePeriod(scope, label)
    await audit(scope, { action: 'period.close', resourceType: 'fiscal_period', resourceId: row.id, after: { label } })
    revalidatePath('/settings')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function reopenPeriodAction(_prev: PeriodOpState, formData: FormData): Promise<PeriodOpState> {
  const scope = await requireScope()
  const label = formData.get('label')?.toString()
  if (!label) return { ok: false, error: 'Missing label' }
  try {
    const row = await reopenPeriod(scope, label)
    await audit(scope, { action: 'period.reopen', resourceType: 'fiscal_period', resourceId: row.id, after: { label } })
    revalidatePath('/settings')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export { listPeriods }
