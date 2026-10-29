import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../client'
import { invoiceLines, invoices, stockMovements } from '../schema'

/**
 * One-off backfill for databases created before the stock ledger became the
 * single source of truth. Posted invoices that have no ledger rows yet get
 * `in`/`out` movements, exactly as posting them today would write.
 *
 * Safe to run more than once: an invoice that already has ledger rows is skipped.
 */
async function main() {
  const posted = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      type: invoices.type,
      date: invoices.date,
      number: invoices.number,
      voucherId: invoices.voucherId,
    })
    .from(invoices)
    .where(
      and(
        inArray(invoices.status, ['sent', 'paid', 'partially_paid']),
        isNotNull(invoices.voucherId),
      ),
    )

  let inserted = 0
  let skipped = 0

  for (const invoice of posted) {
    const existing = await db
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, invoice.tenantId),
          eq(stockMovements.voucherId, invoice.voucherId!),
        ),
      )
      .limit(1)
    if (existing.length > 0) {
      skipped += 1
      continue
    }

    const lines = await db
      .select({
        productId: invoiceLines.productId,
        quantity: invoiceLines.quantity,
        unitPrice: invoiceLines.unitPrice,
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoice.id))
    const rows = lines
      .filter((l) => l.productId)
      .map((l) => ({
        tenantId: invoice.tenantId,
        productId: l.productId as string,
        voucherId: invoice.voucherId,
        date: invoice.date,
        quantity: l.quantity,
        unitCost: l.unitPrice,
        type: invoice.type === 'purchase' ? ('in' as const) : ('out' as const),
        reference: invoice.number ?? invoice.id,
      }))
    if (rows.length === 0) continue

    await db.insert(stockMovements).values(rows)
    inserted += rows.length
  }

  console.log(`${posted.length} posted invoices checked, ${inserted} ledger rows added, ${skipped} already complete.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
