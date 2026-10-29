import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { taxRates } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

const KINDS = ['vat', 'ait', 'vds', 'customs'] as const

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Basis points: 1500 = 15.00%. */
  rate: z.number().int().min(0).max(10000),
  kind: z.enum(KINDS).optional(),
})

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  rate: z.number().int().min(0).max(10000).optional(),
  kind: z.enum(KINDS).optional(),
  active: z.boolean().optional(),
})

export async function getAllTaxRates() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx
      .select()
      .from(taxRates)
      .where(eq(taxRates.tenantId, scope.tenantId))
      .orderBy(taxRates.kind, taxRates.name),
  )
}

export async function createTaxRate(input: unknown) {
  const scope = await requireScope()
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('name, a rate between 0 and 100% and a known kind are required')

  return withTenant(scope.tenantId, async (tx) => {
    const [clash] = await tx
      .select({ id: taxRates.id })
      .from(taxRates)
      .where(and(eq(taxRates.tenantId, scope.tenantId), eq(taxRates.name, parsed.data.name)))
    if (clash) throw conflict('a tax rate with that name already exists')

    const [row] = await tx
      .insert(taxRates)
      .values({
        tenantId: scope.tenantId,
        name: parsed.data.name,
        rate: parsed.data.rate,
        kind: parsed.data.kind ?? 'vat',
      })
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'tax_rate.create',
        resourceType: 'tax_rate',
        resourceId: row.id,
        after: row,
      },
      tx,
    )
    return row
  })
}

export async function updateTaxRate(input: unknown) {
  const scope = await requireScope()
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')
  const { id, ...patch } = parsed.data
  if (Object.keys(patch).length === 0) throw badRequest('nothing to update')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.id, id), eq(taxRates.tenantId, scope.tenantId)))
    if (!target) throw notFound('tax rate not found')

    if (patch.name && patch.name !== target.name) {
      const [clash] = await tx
        .select({ id: taxRates.id })
        .from(taxRates)
        .where(and(eq(taxRates.tenantId, scope.tenantId), eq(taxRates.name, patch.name), ne(taxRates.id, id)))
      if (clash) throw conflict('a tax rate with that name already exists')
    }

    const [row] = await tx
      .update(taxRates)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(taxRates.id, id), eq(taxRates.tenantId, scope.tenantId)))
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'tax_rate.update',
        resourceType: 'tax_rate',
        resourceId: id,
        before: target,
        after: row,
      },
      tx,
    )
    return row
  })
}

export async function deleteTaxRate(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.id, id), eq(taxRates.tenantId, scope.tenantId)))
    if (!target) throw notFound('tax rate not found')

    // Invoices copy the rate they used, so deleting a definition cannot rewrite
    // history. Prefer deactivating; deletion is for typos.
    await tx.delete(taxRates).where(and(eq(taxRates.id, id), eq(taxRates.tenantId, scope.tenantId)))
    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'tax_rate.delete',
        resourceType: 'tax_rate',
        resourceId: id,
        before: target,
      },
      tx,
    )
    return { id }
  })
}
