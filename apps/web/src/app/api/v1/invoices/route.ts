import { NextRequest } from 'next/server'
import { invoiceLines, invoices } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { deriveInvoiceLines, InvoiceLineSchema, resolveCustomerId } from '@/lib/invoice-write'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  date: z.string(),
  number: z.string().optional(),
  /** Item lines; when present they define the invoice total and VAT. */
  lines: z.array(InvoiceLineSchema).min(1).optional(),
  total: z.number().int().nonnegative().optional(),
  vat: z.number().int().nonnegative().optional(),
})

export async function GET() {
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
    return Response.json({ data: rows.map((r) => ({ ...r, lineCount: byInvoice.get(r.id) ?? 0 })) })
  })
}

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  const { lines } = parsed.data
  if (!lines && parsed.data.total == null) {
    return Response.json(
      { error: { code: 'VALIDATION', message: 'provide item lines or an explicit total' } },
      { status: 400 },
    )
  }

  return withTenant(scope.tenantId, async (tx) => {
    // Totals are derived from the lines when they are present, so the header can
    // never disagree with the items.
    const derived = deriveInvoiceLines(lines ?? [])
    const total = (parsed.data.total ?? 0) + derived.total
    const vat = (parsed.data.vat ?? 0) + derived.vat

    const customerId = await resolveCustomerId(tx, scope.tenantId, parsed.data.customerId, parsed.data.customerName)

    const [row] = await tx.insert(invoices).values({
      tenantId: scope.tenantId,
      customerId: customerId ?? null,
      date: new Date(parsed.data.date),
      total,
      vat,
      number: parsed.data.number,
    }).returning()

    if (derived.rows.length > 0) {
      await tx.insert(invoiceLines).values(
        derived.rows.map((l) => ({ tenantId: scope.tenantId, invoiceId: row.id, ...l })),
      )
    }

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'invoice.create',
      resourceType: 'invoice',
      resourceId: row.id,
      after: { total, vat, lines: derived.rows.length },
    }, tx)

    return Response.json({ data: { ...row, lines: derived.rows } }, { status: 201 })
  })
}