import { type AccountType } from '@neurobook/shared'

export { parseTaka, sanitizeAmount } from './money-input'

/** VAT portion extracted from a VAT-inclusive total at the given rate. */
export function vatFromInclusive(totalMinor: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0
  return Math.round((totalMinor * ratePercent) / (100 + ratePercent))
}

export interface InvoiceEntry {
  accountId: string
  accountType: AccountType
  debit: number
  credit: number
  reference?: string
}

export interface InvoiceAmounts {
  /** Invoice total, VAT included, in minor units. */
  totalMinor: number
  /** VAT portion, in minor units. */
  vatMinor: number
  /** Taxable value (total minus VAT), in minor units. */
  netMinor: number
}

export interface InvoiceMapping {
  party: string
  income: string
  tax: string
}

/**
 * Builds the balanced double entry for an invoice. Sales: receivable debited,
 * income and VAT payable credited. Purchase: expense and VAT input debited,
 * payable credited. Lines with a zero amount are dropped.
 */
export function buildInvoiceEntries(
  kind: 'sales' | 'purchase',
  amounts: InvoiceAmounts,
  mapping: InvoiceMapping,
  reference?: string,
): InvoiceEntry[] {
  const { totalMinor, vatMinor, netMinor } = amounts
  const rows: InvoiceEntry[] = []

  if (kind === 'sales') {
    rows.push({ accountId: mapping.party, accountType: 'ASSET', debit: totalMinor, credit: 0, reference })
    rows.push({ accountId: mapping.income, accountType: 'REVENUE', debit: 0, credit: netMinor, reference })
    if (vatMinor > 0) rows.push({ accountId: mapping.tax, accountType: 'LIABILITY', debit: 0, credit: vatMinor, reference })
  } else {
    rows.push({ accountId: mapping.income, accountType: 'EXPENSE', debit: netMinor, credit: 0, reference })
    if (vatMinor > 0) rows.push({ accountId: mapping.tax, accountType: 'ASSET', debit: vatMinor, credit: 0, reference })
    rows.push({ accountId: mapping.party, accountType: 'LIABILITY', debit: 0, credit: totalMinor, reference })
  }

  return rows.filter((r) => r.debit > 0 || r.credit > 0)
}
