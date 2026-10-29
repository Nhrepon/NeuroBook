import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { categories, productSkus, products, stockMovements, warehouses } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, notFound } from '@/controllers/errors'

/**
 * The stock ledger (`stock_movements`) is the single source of truth for
 * quantity. Every in/out/transfer/adjustment is one row, so the on-hand figure
 * and the history can never drift: on-hand is always the sum of the ledger.
 */
type MovementType = 'in' | 'out' | 'transfer' | 'adjustment'

function signedQuantity(type: string, quantity: number): number {
  if (type === 'in') return quantity
  if (type === 'out') return -quantity
  if (type === 'adjustment') return quantity
  // A transfer moves goods between warehouses; company-wide stock is unchanged.
  return 0
}

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
    const moves = await tx
      .select({
        productId: stockMovements.productId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        date: stockMovements.date,
      })
      .from(stockMovements)
      .where(eq(stockMovements.tenantId, scope.tenantId))

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
      transferred: number
      onHand: number
      lastMovedAt: Date | null
    }
    const tally = new Map<string, Tally>()
    const get = (productId: string): Tally => {
      let t = tally.get(productId)
      if (!t) {
        t = { purchased: 0, sold: 0, adjusted: 0, transferred: 0, onHand: 0, lastMovedAt: null }
        tally.set(productId, t)
      }
      return t
    }

    for (const m of moves) {
      const t = get(m.productId)
      if (m.type === 'in') t.purchased += m.quantity
      else if (m.type === 'out') t.sold += m.quantity
      else if (m.type === 'adjustment') t.adjusted += m.quantity
      else if (m.type === 'transfer') t.transferred += m.quantity
      t.onHand += signedQuantity(m.type, m.quantity)
      if (!t.lastMovedAt || m.date > t.lastMovedAt) t.lastMovedAt = m.date
    }

    return rows
      .map((r) => {
        const t = tally.get(r.id)
        const onHand = t?.onHand ?? 0
        // Value stock at the purchase cost when one is known, otherwise at price.
        const unitValue = r.costPrice > 0 ? r.costPrice : r.price
        return {
          ...r,
          category: r.categoryId ? (catMap.get(r.categoryId) ?? null) : null,
          skus: skuMap.get(r.id) ?? [],
          purchased: t?.purchased ?? 0,
          sold: t?.sold ?? 0,
          adjusted: t?.adjusted ?? 0,
          transferred: t?.transferred ?? 0,
          onHand,
          stockValue: onHand * unitValue,
          lastMovedAt: t?.lastMovedAt ?? null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  })
}

interface StockMovementRow {
  id: string
  kind: MovementType
  date: Date
  quantity: number
  unitCost: number
  reference: string | null
  description: string | null
  warehouse: string | null
  toWarehouse: string | null
}

const KIND_ORDER: Record<MovementType, number> = { in: 0, out: 1, transfer: 2, adjustment: 3 }

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

    const moves = await tx
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        date: stockMovements.date,
        quantity: stockMovements.quantity,
        unitCost: stockMovements.unitCost,
        reference: stockMovements.reference,
        warehouseId: stockMovements.warehouseId,
        toWarehouseId: stockMovements.toWarehouseId,
      })
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, id), eq(stockMovements.tenantId, scope.tenantId)))

    const whIds = Array.from(
      new Set(moves.flatMap((m) => [m.warehouseId, m.toWarehouseId]).filter(Boolean) as string[]),
    )
    const whMap = new Map<string, string>()
    if (whIds.length > 0) {
      const whs = await tx
        .select({ id: warehouses.id, name: warehouses.name })
        .from(warehouses)
        .where(eq(warehouses.tenantId, scope.tenantId))
      for (const w of whs) whMap.set(w.id, w.name)
    }

    const movements: StockMovementRow[] = moves
      .map((m) => ({
        id: m.id,
        kind: m.type as MovementType,
        date: m.date,
        quantity: signedQuantity(m.type, m.quantity),
        unitCost: m.unitCost,
        reference: m.reference,
        description: m.type === 'adjustment' ? (m.reference ?? 'Manual adjustment') : null,
        warehouse: m.warehouseId ? (whMap.get(m.warehouseId) ?? null) : null,
        toWarehouse: m.toWarehouseId ? (whMap.get(m.toWarehouseId) ?? null) : null,
      }))
      .sort(
        (x, y) =>
          y.date.getTime() - x.date.getTime() || KIND_ORDER[x.kind] - KIND_ORDER[y.kind],
      )

    const purchased = movements.filter((m) => m.kind === 'in').reduce((s, m) => s + m.quantity, 0)
    const sold = movements.filter((m) => m.kind === 'out').reduce((s, m) => s - m.quantity, 0)
    const adjusted = movements.filter((m) => m.kind === 'adjustment').reduce((s, m) => s + m.quantity, 0)
    const onHand = purchased - sold + adjusted
    const unitValue = product.costPrice > 0 ? product.costPrice : product.price

    return {
      product: {
        ...product,
        category: category?.name ?? null,
        skus: skus.map((s) => s.sku),
      },
      totals: { purchased, sold, adjusted, onHand, stockValue: onHand * unitValue },
      movements,
    }
  })

  if (!data) throw notFound('product not found')
  return data
}

const AdjustSchema = z.object({
  productId: z.string().uuid(),
  /** Signed: positive adds stock, negative removes it. Four decimals allowed. */
  quantity: z.number().refine((v) => v !== 0, 'quantity cannot be zero'),
  date: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date')
    .optional(),
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
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        reference: parsed.data.reason ?? null,
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
