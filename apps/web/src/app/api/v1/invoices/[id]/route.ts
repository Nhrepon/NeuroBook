import { NextRequest } from 'next/server'
import { invoiceLines, invoices, parties } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { deriveInvoiceLines, InvoiceLineSchema, resolveCustomerId } from '@/lib/invoice-write'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const UpdateSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  date: z.string().optional(),
  number: z.string().nullable().optional(),
  lines: z.array(InvoiceLineSchema).min(1).optional(),
})

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()

  const data = await withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) return null

    const [customer] = invoice.customerId
      ? await tx.select({ id: parties.id, name: parties.name }).from(parties).where(eq(parties.id, invoice.customerId)).limit(1)
      : []
    const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id))
    return { invoice, customer: customer ?? null, lines }
  })

  if (!data) return Response.json({ error: { code: 'NOT_FOUND', message: 'invoice not found' } }, { status: 404 })
  return Response.json({ data: data })
}

/**
 * Edits a draft invoice. Posted invoices are locked: their voucher already holds
 * the journal, so the lines must not drift from it.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) return Response.json({ error: { code: 'NOT_FOUND', message: 'invoice not found' } }, { status: 404 })
    if (invoice.status !== 'draft') {
      return Response.json(
        { error: { code: 'CONFLICT', message: 'only draft invoices can be edited' } },
        { status: 409 },
      )
    }

    const customerId =
      parsed.data.customerId || parsed.data.customerName
        ? await resolveCustomerId(tx, scope.tenantId, parsed.data.customerId, parsed.data.customerName)
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
        await tx.insert(invoiceLines).values(
          derived.rows.map((l) => ({ tenantId: scope.tenantId, invoiceId: invoice.id, ...l })),
        )
      }
    }

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'invoice.update',
      resourceType: 'invoice',
      resourceId: invoice.id,
      before: { total: invoice.total, vat: invoice.vat, number: invoice.number },
      after: { total: row.total, vat: row.vat, number: row.number, lines: derived?.rows.length },
    }, tx)

    return Response.json({ data: { ...row, lines: derived?.rows } })
  })
}