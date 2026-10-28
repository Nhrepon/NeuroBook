import { NextRequest } from 'next/server'
import { companySettings, tenants } from '@/db/schema'
import { forbiddenResponse, requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { can } from '@neurobook/shared'
import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { verifyPassword } from '@/lib/credentials'
import { z } from 'zod'

const Schema = z.object({
  companyName: z.string().min(1),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  currency: z.string().min(1).max(8).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  logoUrl: z.string().max(2048).optional(),
})

const CompanyPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
})

export async function GET() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))
    const [tenant] = await tx
      .select({ passwordHash: tenants.passwordHash })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
    return Response.json({ data: row ?? null, meta: { companyPasswordSet: Boolean(tenant?.passwordHash) } })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))

    const [row] = existing
      ? await tx
          .update(companySettings)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(companySettings.tenantId, scope.tenantId))
          .returning()
      : await tx.insert(companySettings).values({ tenantId: scope.tenantId, ...parsed.data }).returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: existing ? 'settings.update' : 'settings.create',
        resourceType: 'company_settings',
        resourceId: row.id,
        before: existing ?? undefined,
        after: row,
      },
      tx,
    )

    /**
     * `tenants.name` is the canonical company name: it is what the dashboard
     * badge, the company switcher, login and `/auth/me` read. The Settings form
     * writes `company_settings`, so mirror the name here or the rename would
     * only ever show up on invoices and the settings page itself.
     */
    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))

    if (tenant && tenant.name !== parsed.data.companyName) {
      await tx
        .update(tenants)
        .set({ name: parsed.data.companyName, updatedAt: new Date() })
        .where(eq(tenants.id, scope.tenantId))
      await writeAudit(
        {
          tenantId: scope.tenantId,
          userId: scope.userId,
          action: 'tenant.rename',
          resourceType: 'tenant',
          resourceId: scope.tenantId,
          before: { name: tenant.name },
          after: { name: parsed.data.companyName },
        },
        tx,
      )
    }

    return Response.json({ data: row }, { status: existing ? 200 : 201 })
  })
}

/**
 * Company password: the credential the dashboard switcher asks for. It belongs
 * to the tenant, so only ADMIN may rotate it, and the current one must be known
 * (except for the first set, which bootstraps a tenant that has none yet).
 */
export async function PATCH(req: NextRequest) {
  const scope = await requireScope()
  if (!can(scope.role, 'tenant:manage')) return forbiddenResponse()

  const body = await req.json().catch(() => null)
  const parsed = CompanyPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'newPassword must be at least 8 characters' } },
      { status: 400 },
    )
  }

  const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id })

  return withTenant(scope.tenantId, async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id, passwordHash: tenants.passwordHash })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
    if (!tenant) return Response.json({ error: { code: 'NOT_FOUND', message: 'company not found' } }, { status: 404 })

    if (tenant.passwordHash) {
      const ok = await verifyPassword(parsed.data.currentPassword ?? '', tenant.passwordHash)
      if (!ok) {
        return Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'The current company password is incorrect.' } },
          { status: 401 },
        )
      }
    }

    await tx.update(tenants).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(tenants.id, scope.tenantId))

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'tenant.password_change',
      resourceType: 'tenant',
      resourceId: scope.tenantId,
      before: { hadPassword: Boolean(tenant.passwordHash) },
      after: { hadPassword: true },
    }, tx)

    return Response.json({ data: { companyPasswordSet: true } })
  })
}