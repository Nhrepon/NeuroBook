'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { createInvoice, getInvoice } from '@/db/repo/invoices'
import { renderMushak62Pdf } from '@/lib/pdf/mushak'
import { requireScope } from '@/db/scope'
import { audit } from '@/db/repo/audit'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Line = z.object({
  productId: z.string(),
  description: z.string().max(200).default(''),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().min(0).max(100).default(15),
  sdRate: z.number().min(0).max(100).default(0),
})

const InvoiceInput = z.object({
  customerId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(Line).min(1),
  voucherType: z
    .enum(['SALES_INVOICE', 'PURCHASE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE'])
    .default('SALES_INVOICE'),
})

export interface InvoiceState {
  ok: boolean
  invoiceId?: string
  error?: string
}

export async function createInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const raw = JSON.parse(String(formData.get('payload') ?? '{}'))
  const parsed = InvoiceInput.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const scope = await requireScope()

  const { invoice, voucher, totals } = await createInvoice(scope, {
    customerId: parsed.data.customerId,
    date: parsed.data.date,
    lines: parsed.data.lines,
    voucherType: parsed.data.voucherType,
  })

  await audit(scope, {
    action: 'invoice.create',
    resourceType: 'invoice',
    resourceId: invoice.id,
    after: { voucherId: voucher.id, totals },
  })

  revalidatePath('/invoices')
  revalidatePath('/dashboard')
  return { ok: true, invoiceId: invoice.id }
}

export interface InvoicePdfState {
  ok: boolean
  invoiceId?: string
  error?: string
}

export async function downloadInvoicePdfAction(
  _prev: InvoicePdfState,
  formData: FormData,
): Promise<InvoicePdfState> {
  const id = formData.get('invoiceId')?.toString()
  if (!id) return { ok: false, error: 'Missing invoiceId' }
  const scope = await requireScope()

  const invoice = await getInvoice(scope, id)
  if (!invoice) return { ok: false, error: 'Invoice not found' }

  const [company] = await db
    .select({ name: tenants.name, bin: tenants.bin, tin: tenants.tin, address: tenants.address })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId))

  const pdf = await renderMushak62Pdf(invoice, company!)
  void pdf // Phase 3: persist to S3/MinIO and set invoice.pdfUrl; for now the buffer is the proof the render works.

  await audit(scope, {
    action: 'invoice.pdf.render',
    resourceType: 'invoice',
    resourceId: id,
    after: { bytes: pdf.byteLength },
  })

  revalidatePath('/invoices')
  return { ok: true, invoiceId: id }
}
