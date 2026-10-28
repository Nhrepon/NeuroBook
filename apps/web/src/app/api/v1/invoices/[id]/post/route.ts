import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { invoices, vouchers } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { postVoucher } from '@/db/repo/post'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const BodySchema = z.object({
  arAccountId: z.string().uuid(),
  revenueAccountId: z.string().uuid(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
  if (!invoice) return Response.json({ error: { code: 'NOT_FOUND', message: 'invoice not found' } }, { status: 404 })
  if (invoice.status !== 'draft') return Response.json({ error: { code: 'CONFLICT', message: 'invoice already posted' } }, { status: 409 })

  const [draft] = await db.insert(vouchers).values({
    tenantId: scope.tenantId,
    date: invoice.date,
    narration: `Invoice ${invoice.number ?? invoice.id}`,
    voucherType: 'SALES_INVOICE',
    status: 'draft',
    createdBy: scope.userId,
  }).returning()

  const result = await postVoucher({
    tenantId: scope.tenantId,
    userId: scope.userId,
    voucherId: draft.id,
    date: invoice.date.toISOString().slice(0, 10),
    narration: `Invoice ${invoice.number ?? invoice.id}`,
    voucherType: 'SALES_INVOICE' as any,
    entries: [
      { accountId: parsed.data.arAccountId, accountType: 'ASSET', debit: invoice.total, credit: 0 },
      { accountId: parsed.data.revenueAccountId, accountType: 'REVENUE', debit: 0, credit: invoice.total - invoice.vat },
      { accountId: parsed.data.revenueAccountId, accountType: 'LIABILITY', debit: 0, credit: invoice.vat },
    ] as any,
  })

  await db.update(invoices).set({ status: 'sent', voucherId: draft.id }).where(eq(invoices.id, invoice.id))

  return Response.json({ data: { invoiceId: invoice.id, voucherId: draft.id, sequenceNumber: result.sequenceNumber } }, { status: 200 })
}
