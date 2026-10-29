import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { categories, invoiceLines, invoices, productSkus, products, stockMovements } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, notFound } from '@/controllers/errors'

/** Statuses whose item lines have hit the books and therefore affect stock. */
const POSTED_STATUSES = ['sent', 'paid']

/** One row per product: identity, SKUs and the breakdown behind the on-hand figure. */
export async function getStockLevels() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(products).where(eq(products.tenantId, scope.tenantId))
    const skus = await tx.select().from(productSkus).where(eq(productSkus.tenantId, scope.tenantId))
    const cats = await tx
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.tenantId, scope.tenantId))

    // Purchase lines add stock, sales lines remove it. Free-text lines carry no
    // product and are ignored.
    const moved = await tx
      .select({
        productId: invoiceLines.productId,
        quantity: invoiceLines.quantity,
        type: invoices.type,
        date: invoices.date,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .where(and(eq(invoiceLines.tenantId, scope.tenantId), inArray(invoices.status, POSTED_STATUSES)))

    // Manual adjustments carry their own sign.
    const adjustments = await tx
      .select({ productId: stockMovements.productId, quantity: stockMovements.quantity, createdAt: stockMovements.createdAt })
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, scope.tenantId), eq(stockMovements.type, 'adjustment')))

    const skuMap = new Map<string, string[]>()
    for (const s of skus) {
      const list = skuMap.get(s.productId) ?? []
      list.push(s.sku)
      skuMap.set(s.productId, list)
    }
    const catMap = new Map(cats.map((c) => [c.id, c.name]))

    interface Tally {
      purchased: number
      sold: number
      adjusted: number
      lastMovedAt: Date | null
    }
    const tally = new Map<string, Tally>()
    const get = (productId: string): Tally => {
      let t = tally.get(productId)
      if (!t) {
        t = { purchased: 0, sold: 0, adjusted: 0, lastMovedAt: null }
        tally.set(productId, t)
      }
      return t
    }
    const touch = (t: Tally, at: Date) => {
      if (!t.lastMovedAt || at > t.lastMovedAt) t.lastMovedAt = at
    }
    for (const m of moved) {
      if (!m.productId) continue
      const t = get(m.productId)
      if (m.type === 'purchase') t.purchased += m.quantity
      else t.sold += m.quantity
      touch(t, m.date)
    }
    for (const a of adjustments) {
      const t = get(a.productId)
      t.adjusted += a.quantity
      touch(t, a.createdAt)
    }

    return rows
      .map((r) => {
        const t = tally.get(r.id)
        const purchased = t?.purchased ?? 0
        const sold = t?.sold ?? 0
        const adjusted = t?.adjusted ?? 0
        const onHand = purchased - sold + adjusted
        return {
          ...r,
          category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
          skus: skuMap.get(r.id) ?? [],
          purchased,
          sold,
          adjusted,
          onHand,
          /** On-hand valued at the product's default price (minor units). */
          stockValue: onHand * r.price,
          lastMovedAt: t?.lastMovedAt ?? null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  })
}

interface StockMovement {
  id: string
  kind: 'purchase' | 'sale' | 'adjustment'
  date: Date
  quantity: number
  unitCost: number
  reference: string | null
  description: string | null
  invoiceId: string | null
}

/** A single product with its full movement history and derived totals. */
export async function getStockItem(id: string) {
  const scope = await requireScope()
  const data = await withTenant(scope.tenantId, async (tx) => {
    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.tenantId, scope.tenantId)))
    if (!product) return null

    const skus = await tx
      .select({ sku: productSkus.sku })
      .from(productSkus)
      .where(eq(productSkus.productId, id))
    const [category] = product.categoryId
      ? await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, product.categoryId))
      : []

    const lines = await tx
      .select({
        id: invoiceLines.id,
        quantity: invoiceLines.quantity,
        unitPrice: invoiceLines.unitPrice,
        description: invoiceLines.description,
        type: invoices.type,
        date: invoices.date,
        number: invoices.number,
        invoiceId: invoices.id,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .where(
        and(
          eq(invoiceLines.productId, id),
          eq(invoiceLines.tenantId, scope.tenantId),
          inArray(invoices.status, POSTED_STATUSES),
        ),
      )

    const adjustments = await tx
      .select({
        id: stockMovements.id,
        quantity: stockMovements.quantity,
        unitCost: stockMovements.unitCost,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, id),
          eq(stockMovements.tenantId, scope.tenantId),
          eq(stockMovements.type, 'adjustment'),
        ),
      )

    const movements: StockMovement[] = [
      ...lines.map((l) => ({
        id: l.id,
        kind: (l.type === 'purchase' ? 'purchase' : 'sale') as StockMovement['kind'],
        date: l.date,
        quantity: l.type === 'purchase' ? l.quantity : -l.quantity,
        unitCost: l.unitPrice,
        reference: l.number ?? null,
        description: l.description,
        invoiceId: l.invoiceId,
      })),
      ...adjustments.map((a) => ({
        id: a.id,
        kind: 'adjustment' as const,
        date: a.createdAt,
        quantity: a.quantity,
        unitCost: a.unitCost,
        reference: null,
        description: 'Manual adjustment',
        invoiceId: null,
      })),
    ].sort((x, y) => y.date.getTime() - x.date.getTime())

    const purchased = movements.filter((m) => m.kind === 'purchase').reduce((s, m) => s + m.quantity, 0)
    const sold = movements.filter((m) => m.kind === 'sale').reduce((s, m) => s + m.quantity, 0)
    const adjusted = movements.filter((m) => m.kind === 'adjustment').reduce((s, m) => s + m.quantity, 0)
    const onHand = purchased - sold + adjusted

    return {
      product: {
        ...product,
        category: category?.name ?? null,
        skus: skus.map((s) => s.sku),
      },
      totals: { purchased, sold, adjusted, onHand, stockValue: onHand * product.price },
      movements,
    }
  })

  if (!data) throw notFound('product not found')
  return data
}

const AdjustSchema = z.object({
  productId: z.string().uuid(),
  /** Signed: positive adds stock, negative removes it. */
  quantity: z.number().int().refine((v) => v !== 0, 'quantity cannot be zero'),
  reason: z.string().trim().max(200).optional(),
})

/** Manual stock adjustment (opening balance, damage, stock count correction). */
export async function adjustStock(input: unknown) {
  const scope = await requireScope()
  const parsed = AdjustSchema.safeParse(input)
  if (!parsed.success) throw badRequest('productId and a non-zero quantity are required')

  return withTenant(scope.tenantId, async (tx) => {
    const [product] = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, parsed.data.productId), eq(products.tenantId, scope.tenantId)))
    if (!product) throw notFound('product not found')

    const [row] = await tx
      .insert(stockMovements)
      .values({
        tenantId: scope.tenantId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        type: 'adjustment',
      })
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'stock.adjust',
        resourceType: 'stock_movement',
        resourceId: row.id,
        after: {
          productId: parsed.data.productId,
          product: product.name,
          quantity: parsed.data.quantity,
          reason: parsed.data.reason ?? null,
        },
      },
      tx,
    )

    return row
  })
}
