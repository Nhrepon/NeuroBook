import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { categories, invoiceLines, productSkus, products, stockMovements } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

const ItemSchema = z.object({
  name: z.string().min(1),
  nameBn: z.string().trim().optional(),
  code: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  category: z.string().trim().min(1).optional(),
  unit: z.string().trim().optional(),
  price: z.number().int().nonnegative().optional(),
  costPrice: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  sku: z.string().trim().min(1).optional(),
  active: z.boolean().optional(),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  nameBn: z.string().trim().nullable().optional(),
  code: z.string().trim().min(1).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(1).optional(),
  unit: z.string().trim().nullable().optional(),
  price: z.number().int().nonnegative().optional(),
  costPrice: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
})

/** A readable starting point for an auto-generated SKU: `SKU-A4-PAPER`. */
function defaultSkuBase(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return base ? `SKU-${base}` : 'SKU'
}

/** Appends `-2`, `-3`, ... until the SKU is free within the company. */
function uniqueSku(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export async function getAllProducts() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(products).where(eq(products.tenantId, scope.tenantId))
    const catIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean))) as string[]
    const catMap = new Map<string, string>()
    if (catIds.length > 0) {
      const cats = await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(inArray(categories.id, catIds))
      cats.forEach((c) => catMap.set(c.id, c.name))
    }
    const skus = await tx.select().from(productSkus).where(eq(productSkus.tenantId, scope.tenantId))
    const skuMap = new Map<string, string[]>()
    skus.forEach((s) => {
      const arr = skuMap.get(s.productId) ?? []
      arr.push(s.sku)
      skuMap.set(s.productId, arr)
    })
    return rows.map((r) => ({
      ...r,
      category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
      skus: skuMap.get(r.id) ?? [],
    }))
  })
}

export async function createProducts(input: unknown) {
  const scope = await requireScope()
  const items = Array.isArray(input)
    ? input
    : input && Array.isArray((input as any).items)
      ? (input as any).items
      : input
        ? [input]
        : null
  if (!items || items.length === 0) throw badRequest('invalid input')

  const parsed = items.map((it: unknown) => ItemSchema.safeParse(it))
  if (parsed.some((p: { success: boolean }) => !p.success)) throw badRequest('every item needs a name')
  const data = parsed.map((p: { data: z.infer<typeof ItemSchema> }) => p.data)

  return withTenant(scope.tenantId, async (tx) => {
    const categoryIds = await Promise.all(
      data.map(async (d: z.infer<typeof ItemSchema>) => {
        if (d.categoryId) return d.categoryId
        if (!d.category) return null
        const [existing] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.tenantId, scope.tenantId), eq(categories.name, d.category)))
        if (existing) return existing.id
        const [created] = await tx
          .insert(categories)
          .values({ tenantId: scope.tenantId, name: d.category })
          .returning({ id: categories.id })
        return created.id
      }),
    )

    // Every product gets at least one SKU. When the caller omits one, derive a
    // readable default from the name and make it unique within the company.
    const existingSkus = await tx
      .select({ sku: productSkus.sku })
      .from(productSkus)
      .where(eq(productSkus.tenantId, scope.tenantId))
    const taken = new Set(existingSkus.map((r) => r.sku))

    const requestedSkus = data.map((d: z.infer<typeof ItemSchema>) => d.sku).filter(Boolean) as string[]
    if (requestedSkus.length > 0) {
      const clash = requestedSkus.filter((s) => taken.has(s))
      if (clash.length > 0) throw conflict(`SKU already exists: ${clash.join(', ')}`)
      if (new Set(requestedSkus).size !== requestedSkus.length) throw conflict('duplicate SKU in this batch')
      requestedSkus.forEach((s) => taken.add(s))
    }

    const requestedCodes = data.map((d: z.infer<typeof ItemSchema>) => d.code).filter(Boolean) as string[]
    if (requestedCodes.length > 0) {
      if (new Set(requestedCodes).size !== requestedCodes.length) throw conflict('duplicate item code in this batch')
      const existingCodes = await tx
        .select({ code: products.code })
        .from(products)
        .where(and(eq(products.tenantId, scope.tenantId), inArray(products.code, requestedCodes)))
      if (existingCodes.length > 0) {
        throw conflict(`Item code already exists: ${existingCodes.map((c) => c.code).join(', ')}`)
      }
    }

    const resolvedSkus: string[] = data.map((d: z.infer<typeof ItemSchema>) => {
      if (d.sku) return d.sku
      const candidate = uniqueSku(defaultSkuBase(d.name), taken)
      taken.add(candidate)
      return candidate
    })

    const rows = await tx
      .insert(products)
      .values(
        data.map((d: z.infer<typeof ItemSchema>, i: number) => ({
          tenantId: scope.tenantId,
          name: d.name,
          nameBn: d.nameBn ?? null,
          code: d.code ?? null,
          categoryId: categoryIds[i],
          unit: d.unit ?? null,
          price: d.price ?? 0,
          costPrice: d.costPrice ?? 0,
          reorderLevel: d.reorderLevel ?? 0,
          active: d.active ?? true,
        })),
      )
      .returning()

    await tx.insert(productSkus).values(
      resolvedSkus.map((sku, i) => ({ tenantId: scope.tenantId, productId: rows[i].id, sku })),
    )

    const catMap = new Map<string, string>()
    const catIds = Array.from(new Set(rows.map((r) => r.categoryId).filter(Boolean))) as string[]
    if (catIds.length > 0) {
      const cats = await tx
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(inArray(categories.id, catIds))
      cats.forEach((c) => catMap.set(c.id, c.name))
    }
    const allSkuRows = await tx.select().from(productSkus).where(eq(productSkus.tenantId, scope.tenantId))
    const skuMap = new Map<string, string[]>()
    allSkuRows.forEach((s) => {
      const arr = skuMap.get(s.productId) ?? []
      arr.push(s.sku)
      skuMap.set(s.productId, arr)
    })
    const enriched = rows.map((r) => ({
      ...r,
      category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
      skus: skuMap.get(r.id) ?? [],
    }))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: rows.length === 1 ? 'product.create' : 'product.bulk_create',
        resourceType: 'product',
        resourceId: rows.length === 1 ? rows[0].id : null,
        after: rows.length === 1 ? { name: rows[0].name, category: enriched[0].category } : { count: rows.length },
      },
      tx,
    )

    return enriched.length === 1 && data.length === 1 ? enriched[0] : enriched
  })
}

export async function updateProduct(input: unknown) {
  const scope = await requireScope()
  const parsed = PatchSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')
  const d = parsed.data
  if (Object.keys(d).length <= 1) throw badRequest('nothing to update')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, d.id), eq(products.tenantId, scope.tenantId)))
    if (!target) throw notFound('product not found')

    if (d.code && d.code !== target.code) {
      const [clash] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, scope.tenantId), eq(products.code, d.code)))
      if (clash && clash.id !== target.id) throw conflict('item code already exists')
    }

    let categoryId: string | null | undefined = d.categoryId
    if (d.category !== undefined) {
      const [existing] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.tenantId, scope.tenantId), eq(categories.name, d.category)))
      if (existing) categoryId = existing.id
      else {
        const [created] = await tx
          .insert(categories)
          .values({ tenantId: scope.tenantId, name: d.category })
          .returning({ id: categories.id })
        categoryId = created.id
      }
    }

    const patch: Record<string, unknown> = {}
    if (d.name !== undefined) patch.name = d.name
    if (d.nameBn !== undefined) patch.nameBn = d.nameBn
    if (d.code !== undefined) patch.code = d.code
    if (categoryId !== undefined) patch.categoryId = categoryId
    if (d.unit !== undefined) patch.unit = d.unit
    if (d.price !== undefined) patch.price = d.price
    if (d.costPrice !== undefined) patch.costPrice = d.costPrice
    if (d.reorderLevel !== undefined) patch.reorderLevel = d.reorderLevel
    if (d.active !== undefined) patch.active = d.active
    if (Object.keys(patch).length === 0) throw badRequest('nothing to update')

    const [row] = await tx
      .update(products)
      .set(patch)
      .where(and(eq(products.id, d.id), eq(products.tenantId, scope.tenantId)))
      .returning()
    const [cat] = row.categoryId
      ? await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, row.categoryId))
      : [null]
    const skus = await tx.select({ sku: productSkus.sku }).from(productSkus).where(eq(productSkus.productId, row.id))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'product.update',
        resourceType: 'product',
        resourceId: row.id,
        before: { name: target.name, categoryId: target.categoryId, unit: target.unit, active: target.active },
        after: { name: row.name, categoryId: row.categoryId, unit: row.unit, active: row.active },
      },
      tx,
    )

    return { ...row, category: cat?.name ?? null, skus: skus.map((s) => s.sku) }
  })
}

export async function deleteProduct(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, scope.tenantId)))
    if (!target) throw notFound('product not found')

    // A product with history must stay in the books; deactivate it instead of
    // deleting, so stock and invoice history keep their item.
    const [moved] = await tx
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, scope.tenantId), eq(stockMovements.productId, id)))
      .limit(1)
    const [invoiced] = await tx
      .select({ id: invoiceLines.id })
      .from(invoiceLines)
      .where(and(eq(invoiceLines.tenantId, scope.tenantId), eq(invoiceLines.productId, id)))
      .limit(1)
    if (moved || invoiced) {
      throw conflict('this product has stock or invoice history; deactivate it instead of deleting')
    }

    await tx.delete(products).where(and(eq(products.id, id), eq(products.tenantId, scope.tenantId)))
    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'product.delete',
        resourceType: 'product',
        resourceId: id,
        before: { name: target.name },
      },
      tx,
    )
    return { id, name: target.name }
  })
}