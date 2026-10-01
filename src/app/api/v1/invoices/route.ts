import { NextRequest } from 'next/server'
import { ok, created, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { listInvoices, createInvoice, type InvoiceLine } from '@/db/repo/invoices'
import { audit } from '@/db/repo/audit'
import { z } from 'zod'

const Line = z.object({
  productId: z.string(),
  description: z.string().max(200).default(''),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100).default(15),
  sdRate: z.number().min(0).max(100).default(0),
})

const CreateInvoice = z.object({
  customerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(Line).min(1),
  voucherType: z
    .enum(['SALES_INVOICE', 'PURCHASE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE'])
    .default('SALES_INVOICE'),
})

// GET /api/v1/invoices?limit=
export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50)
  return ok(await listInvoices(scope, limit))
}

// POST /api/v1/invoices
export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const parsed = CreateInvoice.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400)
  }
  const { invoice, voucher, totals } = await createInvoice(scope, {
    customerId: parsed.data.customerId,
    date: parsed.data.date,
    lines: parsed.data.lines as InvoiceLine[],
    voucherType: parsed.data.voucherType,
  })
  await audit(scope, {
    action: 'invoice.create',
    resourceType: 'invoice',
    resourceId: invoice.id,
    after: { voucherId: voucher.id, totals },
  })
  return created({ invoice, voucherId: voucher.id, totals })
}
