// Invoices (Mushak 6.2 sales / Phase 3). An invoice is a draft
// SALES_INVOICE voucher + a document row. Posting the voucher makes it a
// legal document; the PDF is renderable from the draft.
import { db } from '../client'
import { invoices } from '../schema/invoices'
import { and, desc, eq, sql } from 'drizzle-orm'
import { applyRate, toMinor, type JournalEntry } from '@neurobook/shared'
import { createVoucher } from './vouchers'
import type { RequestScope } from '../scope'

export interface InvoiceLine {
  productId: string
  description: string
  quantity: number       // major units, may be fractional
  unitPrice: number      // major units
  vatRate: number        // percent, e.g. 15
  sdRate: number         // percent, supplementary duty
}

export interface InvoiceTotals {
  subtotalMinor: number
  vatMinor: number
  sdMinor: number
  tdsMinor: number
  grandTotalMinor: number
  lines: Array<InvoiceLine & {
    lineTotalMinor: number
    vatMinor: number
    sdMinor: number
  }>
}

/**
 * Compute invoice line totals at millitaka precision (R7) — fractional
 * quantities and the 7.5% band need 3 dp before rounding per line.
 * Residual lands in the Rounding Difference account at post.
 */
export function computeInvoiceTotals(lines: InvoiceLine[]): InvoiceTotals {
  let subtotal = 0
  let vat = 0
  let sd = 0
  const computed = lines.map((l) => {
    // quantity × unitPrice at major-precision, then to minor.
    const lineMinor = toMinor(l.quantity * l.unitPrice)
    const vatMinor = applyRate(lineMinor, Math.round(l.vatRate * 100))
    // SD compounds on top of (line + VAT).
    const sdMinor = applyRate(lineMinor + vatMinor, Math.round(l.sdRate * 100))
    subtotal += lineMinor
    vat += vatMinor
    sd += sdMinor
    return { ...l, lineTotalMinor: lineMinor, vatMinor, sdMinor }
  })
  return {
    subtotalMinor: subtotal,
    vatMinor: vat,
    sdMinor: sd,
    tdsMinor: 0, // TDS is deducted by the payer — recorded at payment, not invoice.
    grandTotalMinor: subtotal + vat + sd,
    lines: computed,
  }
}

/** Journal entries for a sales invoice: Dr customer, Cr revenue + VAT + SD. */
export function invoiceEntries(
  totals: InvoiceTotals,
  accounts: { customer: string; revenue: string; vatPayable: string; sdPayable: string },
): JournalEntry[] {
  const entries: JournalEntry[] = [
    { accountId: accounts.customer, accountType: 'ASSET', debit: totals.grandTotalMinor, credit: 0 },
    { accountId: accounts.revenue, accountType: 'REVENUE', debit: 0, credit: totals.subtotalMinor },
  ]
  if (totals.vatMinor > 0) {
    entries.push({ accountId: accounts.vatPayable, accountType: 'LIABILITY', debit: 0, credit: totals.vatMinor })
  }
  if (totals.sdMinor > 0) {
    entries.push({ accountId: accounts.sdPayable, accountType: 'LIABILITY', debit: 0, credit: totals.sdMinor })
  }
  return entries
}

export type InvoiceRow = typeof invoices.$inferSelect

export async function listInvoices(scope: RequestScope, limit = 50) {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.tenantId, scope.tenantId))
    .orderBy(desc(invoices.date))
    .limit(limit)
}

export async function getInvoice(scope: RequestScope, id: string) {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
  return row ?? null
}

export async function createInvoice(
  scope: RequestScope,
  input: {
    customerId: string
    date: string
    lines: InvoiceLine[]
    voucherType?: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'DEBIT_NOTE' | 'CREDIT_NOTE'
    accountMap?: Partial<Record<'customer' | 'supplier' | 'revenue' | 'expense' | 'vatPayable' | 'sdPayable', string>>
  },
) {
  const totals = computeInvoiceTotals(input.lines)
  const type = input.voucherType ?? 'SALES_INVOICE'
  const direction = type === 'PURCHASE_INVOICE' ? 'Cr' : 'Dr'

  const voucher = await createVoucher(scope, {
    voucherType: type,
    date: input.date,
    narration: `Invoice: ${input.customerId}`,
    entries: invoiceEntries(totals, {
      customer: input.accountMap?.customer ?? input.customerId,
      revenue: input.accountMap?.revenue ?? '',
      vatPayable: input.accountMap?.vatPayable ?? '',
      sdPayable: input.accountMap?.sdPayable ?? '',
    }).filter((e) => e.accountId),
  })

  const [row] = await db
    .insert(invoices)
    .values({
      tenantId: scope.tenantId,
      customerId: input.customerId,
      voucherId: voucher.id,
      date: new Date(input.date),
      payload: {
        lines: input.lines,
        totals,
        direction,
        voucherType: type,
      },
    })
    .returning()
  if (!row) throw new Error('Invoice insert returned no row')
  return { invoice: row, voucher, totals }
}

// `sql` is kept for period-filtered queries added later.
void sql
