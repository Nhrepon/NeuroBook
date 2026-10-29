import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { productSkus, products } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

const Schema = z.object({
  productId: z.string().uuid(),
  sku: z.string().trim().min(1).optional(),
  skus: z.array(z.string().trim().min(1)).optional(),
  barcode: z.string().trim().min(1).optional(),
})

export async function getAllProductSkus(productId?: string | null) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const conds = [eq(productSkus.tenantId, scope.tenantId)]
    if (productId) conds.push(eq(productSkus.productId, productId))
    return tx.select().from(productSkus).where(and(...conds)).orderBy(productSkus.createdAt)
  })
}

export async function createProductSkus(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('productId and sku(s) required')

  const { productId, sku, skus, barcode } = parsed.data
  const list = skus && skus.length > 0 ? skus : sku ? [sku] : []
  if (list.length === 0) throw badRequest('at least one SKU is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.tenantId, scope.tenantId)))
    if (!product) throw notFound('product not found')

    const existing = await tx
      .select({ sku: productSkus.sku })
      .from(productSkus)
      .where(and(eq(productSkus.tenantId, scope.tenantId), inArray(productSkus.sku, list)))
    const existingSet = new Set(existing.map((e) => e.sku))

    const seen = new Set<string>()
    const toCreate: string[] = []
    const skipped: string[] = []
    for (const s of list) {
      if (existingSet.has(s) || seen.has(s)) skipped.push(s)
      else {
        seen.add(s)
        toCreate.push(s)
      }
    }

    if (toCreate.length === 0) return { data: [], skipped }

    if (barcode && list.length === 1) {
      const [clash] = await tx
        .select({ id: productSkus.id })
        .from(productSkus)
        .where(and(eq(productSkus.tenantId, scope.tenantId), eq(productSkus.barcode, barcode)))
      if (clash) throw conflict('that barcode is already assigned to another SKU')
    }

    const rows = await tx
      .insert(productSkus)
      .values(toCreate.map((s, i) => ({ tenantId: scope.tenantId, productId, sku: s, barcode: list.length === 1 && i === 0 ? (barcode ?? null) : null })))
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: rows.length === 1 ? 'product_sku.create' : 'product_sku.bulk_create',
        resourceType: 'product_sku',
        resourceId: rows.length === 1 ? rows[0].id : null,
        after: { productId, count: rows.length, skipped: skipped.length, barcode: barcode ?? null, skus: rows.map((r) => r.sku) },
      },
      tx,
    )

    return { data: rows, skipped }
  })
}

export async function deleteProductSku(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(productSkus)
      .where(and(eq(productSkus.id, id), eq(productSkus.tenantId, scope.tenantId)))
    if (!target) throw notFound('SKU not found')

    await tx.delete(productSkus).where(and(eq(productSkus.id, id), eq(productSkus.tenantId, scope.tenantId)))
    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'product_sku.delete',
        resourceType: 'product_sku',
        resourceId: id,
        before: { sku: target.sku, productId: target.productId },
      },
      tx,
    )
    return { id, sku: target.sku }
  })
}