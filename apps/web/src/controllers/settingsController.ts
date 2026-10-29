import { eq } from 'drizzle-orm'
import argon2 from 'argon2'
import { z } from 'zod'
import { companySettings, tenants } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { ForbiddenError, requirePermission } from '@/controllers/scope'
import { ApiError, badRequest, notFound } from '@/controllers/errors'
import { verifyPassword } from '@/lib/credentials'
import { can } from '@neurobook/shared'

/** Company identity and contact details, stored on the tenant. */
const ProfileSchema = z.object({
  legalName: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(40).optional(),
  website: z.string().max(2048).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(8).optional(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
})

/** Accounting configuration, stored in company_settings. */
const Schema = z.object({
  companyName: z.string().min(1),
  binNumber: z.string().optional(),
  tinNumber: z.string().optional(),
  currency: z.string().min(1).max(8).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  logoUrl: z.string().max(2048).optional(),
  profile: ProfileSchema.optional(),
})

const PROFILE_KEYS = [
  'legalName', 'email', 'phone', 'website', 'addressLine1', 'addressLine2',
  'city', 'district', 'postalCode', 'country', 'timezone', 'locale', 'status',
] as const

const CompanyPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
})

export async function getSettings() {
  const scope = await requirePermission('settings:write')
  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId))
    return {
      data: row ?? null,
      meta: {
        companyPasswordSet: Boolean(tenant?.passwordHash),
        tenant: tenant
          ? {
              id: tenant.id,
              name: tenant.name,
              slug: tenant.slug,
              tenantCode: tenant.tenantCode,
              legalName: tenant.legalName,
              email: tenant.email,
              phone: tenant.phone,
              website: tenant.website,
              addressLine1: tenant.addressLine1,
              addressLine2: tenant.addressLine2,
              city: tenant.city,
              district: tenant.district,
              postalCode: tenant.postalCode,
              country: tenant.country,
              timezone: tenant.timezone,
              locale: tenant.locale,
              status: tenant.status,
            }
          : null,
      },
    }
  })
}

export async function saveSettings(input: unknown) {
  const scope = await requirePermission('settings:write')
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  const { profile, ...company } = parsed.data

  // Suspending or archiving a company is an admin action, not a settings edit.
  if (profile?.status && !can(scope.role, 'tenant:manage')) throw new ForbiddenError()

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx.select().from(companySettings).where(eq(companySettings.tenantId, scope.tenantId))

    const [row] = existing
      ? await tx
          .update(companySettings)
          .set({ ...company, updatedAt: new Date() })
          .where(eq(companySettings.tenantId, scope.tenantId))
          .returning()
      : await tx.insert(companySettings).values({ tenantId: scope.tenantId, ...company }).returning()

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

    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, scope.tenantId))
    if (!tenant) throw notFound('company not found')

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    // tenants.name stays the single canonical display name.
    if (tenant.name !== company.companyName) patch.name = company.companyName
    if (profile) {
      for (const key of PROFILE_KEYS) {
        if (profile[key] !== undefined) patch[key] = profile[key]
      }
    }

    await tx.update(tenants).set(patch).where(eq(tenants.id, scope.tenantId))

    if (patch.name) {
      await writeAudit(
        {
          tenantId: scope.tenantId,
          userId: scope.userId,
          action: 'tenant.rename',
          resourceType: 'tenant',
          resourceId: scope.tenantId,
          before: { name: tenant.name },
          after: { name: patch.name },
        },
        tx,
      )
    }
    if (profile?.status && profile.status !== tenant.status) {
      await writeAudit(
        {
          tenantId: scope.tenantId,
          userId: scope.userId,
          action: 'tenant.status_change',
          resourceType: 'tenant',
          resourceId: scope.tenantId,
          before: { status: tenant.status },
          after: { status: profile.status },
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
