import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { z } from 'zod'
import { companySettings, tenants } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requirePermission } from '@/controllers/scope'
import { ApiError, badRequest, notFound } from '@/controllers/errors'
import { verifyPassword } from '@/lib/credentials'

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

export async function getSettings() {
  const scope = await requirePermission('settings:write')
  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))
    const [tenant] = await tx
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, passwordHash: tenants.passwordHash })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
    return {
      data: row ?? null,
      meta: {
        companyPasswordSet: Boolean(tenant?.passwordHash),
        tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
      },
    }
  })
}

export async function saveSettings(input: unknown) {
  const scope = await requirePermission('settings:write')
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

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

    const [tenant] = await tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, scope.tenantId))

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

    return row
  })
}

export async function updateCompanyPassword(input: unknown) {
  const scope = await requirePermission('tenant:manage')
  const parsed = CompanyPasswordSchema.safeParse(input)
  if (!parsed.success) throw badRequest('newPassword must be at least 8 characters')

  const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id })

  return withTenant(scope.tenantId, async (tx) => {
    const [tenant] = await tx
      .select({ id: tenants.id, slug: tenants.slug, passwordHash: tenants.passwordHash })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
    if (!tenant) throw notFound('company not found')

    if (tenant.passwordHash) {
      const ok = await verifyPassword(parsed.data.currentPassword ?? '', tenant.passwordHash)
      if (!ok) throw new ApiError(401, 'UNAUTHORIZED', 'The current company password is incorrect.')
    }

    await tx.update(tenants).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(tenants.id, scope.tenantId))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'tenant.password_change',
        resourceType: 'tenant',
        resourceId: scope.tenantId,
        before: { hadPassword: Boolean(tenant.passwordHash) },
        after: { hadPassword: true, slug: tenant.slug, by: 'admin' },
      },
      tx,
    )

    return { companyPasswordSet: true }
  })
}