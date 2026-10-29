import { and, eq, inArray, sql } from 'drizzle-orm'
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

const PRODUCT_CODE_PATTERN = /^P-(\d+)$/i

/** Highest existing `P-0001`-style number, so the next auto code never repeats. */
function nextProductCodeNumber(codes: (string | null)[]): number {
  let max = 0
  for (const code of codes) {
    if (!code) continue
    const match = PRODUCT_CODE_PATTERN.exec(code)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

function formatProductCode(n: number): string {
  return `P-${String(n).padStart(4, '0')}`
}

/** First free `P-xxxx` code, skipping custom codes that already use the format. */
function allocateProductCode(existing: (string | null)[], start: number): { code: string; next: number } {
  const taken = new Set(existing.filter(Boolean).map((c) => c!.toLowerCase()))
  let cursor = start
  while (taken.has(formatProductCode(cursor).toLowerCase())) cursor += 1
  return { code: formatProductCode(cursor), next: cursor + 1 }
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

    // On-hand and history: deleting an item that has moved through stock (or been
    // billed) would erase its trail, so the list needs to know before offering it.
    const movements = await tx
      .select({
        productId: stockMovements.productId,
        onHand: sql<number>`coalesce(sum(case when ${stockMovements.type} = 'in' then ${stockMovements.quantity} when ${stockMovements.type} = 'out' then -${stockMovements.quantity} when ${stockMovements.type} = 'adjustment' then ${stockMovements.quantity} else 0 end),0)::numeric`,
        moves: sql<number>`count(*)::int`,
      })
      .from(stockMovements)
      .where(eq(stockMovements.tenantId, scope.tenantId))
      .groupBy(stockMovements.productId)
    const stockMap = new Map(
      movements.map((m) => [m.productId, { onHand: Number(m.onHand), moves: Number(m.moves) }]),
    )

    const invoiced = await tx
      .select({ productId: invoiceLines.productId })
      .from(invoiceLines)
      .where(eq(invoiceLines.tenantId, scope.tenantId))
      .groupBy(invoiceLines.productId)
    const invoicedIds = new Set(invoiced.map((l) => l.productId).filter(Boolean) as string[])

    return rows.map((r) => {
      const stock = stockMap.get(r.id)
      return {
        ...r,
        category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
        skus: skuMap.get(r.id) ?? [],
        onHand: stock?.onHand ?? 0,
        /** Any previous record — stock movement or invoice line — blocks deletion. */
        hasHistory: Boolean(stock?.moves || invoicedIds.has(r.id)),
      }
    })
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
          .where(
            and(
              eq(categories.tenantId, scope.tenantId),
              sql`lower(${categories.name}) = lower(${d.category.trim().replace(/\s+/g, ' ')})`,
            ),
          )
        if (existing) return existing.id
        const [created] = await tx
          .insert(categories)
          .values({ tenantId: scope.tenantId, name: d.category.trim().replace(/\s+/g, ' ') })
          .onConflictDoNothing()
          .returning({ id: categories.id })
        if (created) return created.id
        const [again] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.tenantId, scope.tenantId),
              sql`lower(${categories.name}) = lower(${d.category.trim().replace(/\s+/g, ' ')})`,
            ),
          )
        return again.id
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

    // Product codes are either supplied (custom) or auto-allocated as P-0001.
    const existingCodeRows = await tx
      .select({ code: products.code })
      .from(products)
      .where(eq(products.tenantId, scope.tenantId))
    const existingCodes = existingCodeRows.map((r) => r.code)
    const takenCodes = new Set(existingCodes.filter(Boolean).map((c) => c!.toLowerCase()))
    let nextCode = nextProductCodeNumber(existingCodes)

    const resolvedCodes: string[] = data.map((d: z.infer<typeof ItemSchema>) => {
      const custom = d.code ? d.code.trim().toUpperCase() : ''
      if (custom) {
        if (takenCodes.has(custom.toLowerCase())) throw conflict(`Item code already exists: ${custom}`)
        takenCodes.add(custom.toLowerCase())
        return custom
      }
      const allocated = allocateProductCode([...takenCodes], nextCode)
      nextCode = allocated.next
      takenCodes.add(allocated.code.toLowerCase())
      return allocated.code
    })

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
          code: resolvedCodes[i],
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

    let codeValue: string | undefined
    if (d.code !== undefined) {
      const custom = d.code ? d.code.trim().toUpperCase() : ''
      if (custom) {
        if (custom !== target.code) {
          const [clash] = await tx
            .select({ id: products.id })
            .from(products)
            .where(and(eq(products.tenantId, scope.tenantId), sql`upper(${products.code}) = ${custom}`))
          if (clash && clash.id !== target.id) throw conflict('item code already exists')
        }
        codeValue = custom
      } else {
        // Clearing the field regenerates an automatic code, so every product keeps one.
        const codeRows = await tx
          .select({ code: products.code })
          .from(products)
          .where(eq(products.tenantId, scope.tenantId))
        const others = codeRows.map((r) => r.code).filter((c) => c !== target.code)
        codeValue = allocateProductCode(others, nextProductCodeNumber(codeRows.map((r) => r.code))).code
      }
    }

    let categoryId: string | null | undefined = d.categoryId
    if (d.category !== undefined) {
      const categoryName = d.category.trim().replace(/\s+/g, ' ')
      const [existing] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.tenantId, scope.tenantId),
            sql`lower(${categories.name}) = lower(${categoryName})`,
          ),
        )
      if (existing) categoryId = existing.id
      else {
        const [created] = await tx
          .insert(categories)
          .values({ tenantId: scope.tenantId, name: categoryName })
          .onConflictDoNothing()
          .returning({ id: categories.id })
        if (created) categoryId = created.id
        else {
          const [again] = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(
              and(
                eq(categories.tenantId, scope.tenantId),
                sql`lower(${categories.name}) = lower(${categoryName})`,
              ),
            )
          categoryId = again.id
        }
      }
    }

    const patch: Record<string, unknown> = {}
    if (d.name !== undefined) patch.name = d.name
    if (d.nameBn !== undefined) patch.nameBn = d.nameBn
    if (d.code !== undefined) patch.code = codeValue
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