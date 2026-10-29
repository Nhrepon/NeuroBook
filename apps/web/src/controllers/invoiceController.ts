import { invoiceLines, invoices, parties, vouchers } from '@/lib/db/schema'
import { requireScope } from '@/controllers/scope'
import { withTenant } from '@/lib/db/tenant'
import { postVoucher } from '@/lib/db/repo/post'
import { writeAudit } from '@/lib/db/audit'
import { deriveInvoiceLines, InvoiceLineSchema, resolveCustomerId } from '@/lib/db/invoice-write'
import { badRequest, notFound, conflict } from '@/controllers/errors'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  type: z.enum(['sale', 'purchase']).optional().default('sale'),
  date: z.string(),
  number: z.string().optional(),
  /** Item lines; when present they define the invoice total and VAT. */
  lines: z.array(InvoiceLineSchema).min(1).optional(),
  total: z.number().int().nonnegative().optional(),
  vat: z.number().int().nonnegative().optional(),
})

const UpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  date: z.string().optional(),
  number: z.string().nullable().optional(),
  lines: z.array(InvoiceLineSchema).min(1).optional(),
})

const PostSchema = z.object({
  // Sales
  arAccountId: z.string().uuid().optional(),
  revenueAccountId: z.string().uuid().optional(),
  // Purchase
  apAccountId: z.string().uuid().optional(),
  expenseAccountId: z.string().uuid().optional(),
  // Shared
  vatAccountId: z.string().uuid().optional(),
})

export async function getAllInvoices() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    // The list shows how many item lines each invoice carries. A grouped count is
    // used rather than a correlated subquery so no unqualified column can collide.
    const rows = await tx.select().from(invoices).where(eq(invoices.tenantId, scope.tenantId))
    const counts = await tx
      .select({ invoiceId: invoiceLines.invoiceId, lineCount: sql<number>`count(*)::int` })
      .from(invoiceLines)
      .where(eq(invoiceLines.tenantId, scope.tenantId))
      .groupBy(invoiceLines.invoiceId)

    const byInvoice = new Map(counts.map((c) => [c.invoiceId, Number(c.lineCount)]))
    return rows.map((r) => ({ ...r, lineCount: byInvoice.get(r.id) ?? 0 }))
  })
}

export async function createInvoice(input: unknown) {
  const scope = await requireScope()
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  const { lines } = parsed.data
  if (!lines && parsed.data.total == null) {
    throw badRequest('provide item lines or an explicit total')
  }

  return withTenant(scope.tenantId, async (tx) => {
    // Totals are derived from the lines when they are present, so the header can
    // never disagree with the items.
    const derived = deriveInvoiceLines(lines ?? [])
    const total = (parsed.data.total ?? 0) + derived.total
    const vat = (parsed.data.vat ?? 0) + derived.vat

    const customerId = await resolveCustomerId(
      tx,
      scope.tenantId,
      parsed.data.customerId,
      parsed.data.customerName,
      parsed.data.type === 'purchase' ? 'SUPPLIER' : 'CUSTOMER',
    )

    const [row] = await tx
      .insert(invoices)
      .values({
        tenantId: scope.tenantId,
        customerId: customerId ?? null,
        type: parsed.data.type ?? 'sale',
        date: new Date(parsed.data.date),
        total,
        vat,
        number: parsed.data.number,
      })
      .returning()

    if (derived.rows.length > 0) {
      await tx
        .insert(invoiceLines)
        .values(derived.rows.map((l) => ({ tenantId: scope.tenantId, invoiceId: row.id, ...l })))
    }

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'invoice.create',
        resourceType: 'invoice',
        resourceId: row.id,
        after: { total, vat, lines: derived.rows.length },
      },
      tx,
    )

    return { ...row, lines: derived.rows }
  })
}

export async function getInvoice(id: string) {
  const scope = await requireScope()
  const data = await withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) return null

    const [customer] = invoice.customerId
      ? await tx
          .select({ id: parties.id, name: parties.name })
          .from(parties)
          .where(eq(parties.id, invoice.customerId))
          .limit(1)
      : []
    const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id))
    return { invoice, customer: customer ?? null, lines }
  })

  if (!data) throw notFound('invoice not found')
  return data
}

/** Invoice, buyer party and lines for the MUSHAK 6.2 document. */
export async function getInvoiceDocument(id: string) {
  const scope = await requireScope()
  const data = await withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) return null

    let customer: typeof parties.$inferSelect | null = null
    if (invoice.customerId) {
      const [c] = await tx.select().from(parties).where(eq(parties.id, invoice.customerId))
      customer = c ?? null
    }
    const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id))
    return { invoice, customer, lines }
  })

  if (!data) throw notFound('invoice not found')
  return data
}

/**
 * Edits a draft invoice. Posted invoices are locked: their voucher already holds
 * the journal, so the lines must not drift from it.
 */
export async function updateInvoice(id: string, input: unknown) {
  const scope = await requireScope()
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) throw notFound('invoice not found')
    if (invoice.status !== 'draft') throw conflict('only draft invoices can be edited')

    const customerId =
      parsed.data.customerId || parsed.data.customerName
        ? await resolveCustomerId(
            tx,
            scope.tenantId,
            parsed.data.customerId,
            parsed.data.customerName,
            invoice.type === 'purchase' ? 'SUPPLIER' : 'CUSTOMER',
          )
        : undefined

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (customerId) patch.customerId = customerId
    if (parsed.data.date) patch.date = new Date(parsed.data.date)
    if (parsed.data.number !== undefined) patch.number = parsed.data.number

    let derived: ReturnType<typeof deriveInvoiceLines> | null = null
    if (parsed.data.lines) {
      derived = deriveInvoiceLines(parsed.data.lines)
      patch.total = derived.total
      patch.vat = derived.vat
    }

    const [row] = await tx
      .update(invoices)
      .set(patch)
      .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, scope.tenantId)))
      .returning()

    if (derived) {
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id))
      if (derived.rows.length > 0) {
        await tx
          .insert(invoiceLines)
          .values(derived.rows.map((l) => ({ tenantId: scope.tenantId, invoiceId: invoice.id, ...l })))
      }
    }

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'invoice.update',
        resourceType: 'invoice',
        resourceId: invoice.id,
        before: { total: invoice.total, vat: invoice.vat, number: invoice.number },
        after: { total: row.total, vat: row.vat, number: row.number, lines: derived?.rows.length },
      },
      tx,
    )

    return { ...row, lines: derived?.rows }
  })
}

export async function postInvoice(id: string, input: unknown) {
  const scope = await requireScope()
  const parsed = PostSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) throw notFound('invoice not found')
    if (invoice.status !== 'draft') throw conflict('invoice already posted')

    const isPurchase = invoice.type === 'purchase'
    const voucherType = isPurchase ? 'PURCHASE_INVOICE' : 'SALES_INVOICE'

    // Validate required accounts for the invoice type.
    if (isPurchase) {
      if (!parsed.data.apAccountId || !parsed.data.expenseAccountId) {
        throw badRequest('apAccountId and expenseAccountId are required for purchase invoices')
      }
    } else {
      if (!parsed.data.arAccountId || !parsed.data.revenueAccountId) {
        throw badRequest('arAccountId and revenueAccountId are required for sales invoices')
      }
    }

    const [draft] = await tx
      .insert(vouchers)
      .values({
        tenantId: scope.tenantId,
        date: invoice.date,
        narration: `${isPurchase ? 'Purchase' : 'Sales'} invoice ${invoice.number ?? invoice.id}`,
        voucherType,
        status: 'draft',
        createdBy: scope.userId,
      })
      .returning()

    const vatAccountId = parsed.data.vatAccountId
    const entries: { accountId: string; accountType: string; debit: number; credit: number }[] = []
    if (isPurchase) {
      // Purchase: debit expense (total - vat), debit VAT input, credit AP (total).
      entries.push({
        accountId: parsed.data.expenseAccountId!,
        accountType: 'EXPENSE',
        debit: invoice.total - invoice.vat,
        credit: 0,
      })
      if (invoice.vat > 0) {
        entries.push({
          accountId: vatAccountId ?? parsed.data.expenseAccountId!,
          accountType: 'ASSET',
          debit: invoice.vat,
          credit: 0,
        })
      }
      entries.push({ accountId: parsed.data.apAccountId!, accountType: 'LIABILITY', debit: 0, credit: invoice.total })
    } else {
      entries.push({ accountId: parsed.data.arAccountId!, accountType: 'ASSET', debit: invoice.total, credit: 0 })
      entries.push({
        accountId: parsed.data.revenueAccountId!,
        accountType: 'REVENUE',
        debit: 0,
        credit: invoice.total - invoice.vat,
      })
      if (invoice.vat > 0) {
        entries.push({
          accountId: vatAccountId ?? parsed.data.revenueAccountId!,
          accountType: 'LIABILITY',
          debit: 0,
          credit: invoice.vat,
        })
      }
    }

    const result = await postVoucher(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        voucherId: draft.id,
        date: invoice.date.toISOString().slice(0, 10),
        narration: `${isPurchase ? 'Purchase' : 'Sales'} invoice ${invoice.number ?? invoice.id}`,
        voucherType: voucherType as any,
        entries: entries as any,
      },
      tx,
    )

    await tx
      .update(invoices)
      .set({ status: 'sent', voucherId: draft.id })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, scope.tenantId)))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'invoice.post',
        resourceType: 'invoice',
        resourceId: invoice.id,
        after: { voucherId: draft.id, sequenceNumber: result.sequenceNumber, type: invoice.type },
      },
      tx,
    )

    return { invoiceId: invoice.id, voucherId: draft.id, sequenceNumber: result.sequenceNumber }
  })
}
