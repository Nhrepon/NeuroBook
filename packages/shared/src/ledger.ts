import type { JournalEntry, VoucherType, VoucherStatus } from './types'

export function computeTotals(entries: JournalEntry[]): { debit: number; credit: number } {
  return entries.reduce((acc, e) => ({ debit: acc.debit + e.debit, credit: acc.credit + e.credit }), { debit: 0, credit: 0 })
}

export function isBalanced(entries: JournalEntry[]): boolean {
  const t = computeTotals(entries)
  return t.debit === t.credit && t.debit > 0
}

export interface ValidateForPostInput { entries: JournalEntry[]; status: VoucherStatus }
export function validateForPost(input: ValidateForPostInput): void {
  if (input.status !== 'draft') throw new Error('IMMUTABLE: only drafts can be posted')
  if (input.entries.length < 2) throw new Error('VALIDATION: at least two entries required')
  for (const e of input.entries) {
    if (e.debit < 0 || e.credit < 0) throw new Error('VALIDATION: negative amounts not allowed')
    if (e.debit === 0 && e.credit === 0) throw new Error('VALIDATION: every entry needs a debit or a credit')
    if (e.debit > 0 && e.credit > 0) throw new Error('VALIDATION: entry cannot have both debit and credit')
  }
  if (!isBalanced(input.entries)) throw new Error('UNBALANCED: total debit must equal total credit')
}

/**
 * Structural rules that keep each voucher family true to its meaning. They are
 * deliberately about account *types* (not specific accounts), so companies stay
 * free to choose their own cash, bank, receivable and payable accounts.
 */
export function assertVoucherShape(input: { type: VoucherType; entries: JournalEntry[] }): void {
  const { type, entries } = input
  const has = (side: 'debit' | 'credit', accountType: JournalEntry['accountType']) =>
    entries.some((e) => e[side] > 0 && e.accountType === accountType)

  switch (type) {
    case 'PAYMENT':
    case 'REFUND':
      if (!has('credit', 'ASSET')) {
        throw new Error('VALIDATION: a payment must credit cash or bank (an asset account)')
      }
      break
    case 'RECEIPT':
      if (!has('debit', 'ASSET')) {
        throw new Error('VALIDATION: a receipt must debit cash or bank (an asset account)')
      }
      break
    case 'CONTRA':
    case 'TRANSFER':
      if (!entries.every((e) => e.accountType === 'ASSET')) {
        throw new Error('VALIDATION: a transfer moves money between asset accounts only')
      }
      break
    case 'SALES_INVOICE':
      if (!has('debit', 'ASSET') || !has('credit', 'REVENUE')) {
        throw new Error('VALIDATION: a sales invoice must debit a receivable and credit revenue')
      }
      break
    case 'PURCHASE_INVOICE':
      if (!has('debit', 'EXPENSE') || !has('credit', 'LIABILITY')) {
        throw new Error('VALIDATION: a purchase invoice must debit an expense and credit a payable')
      }
      break
    default:
      // Journals, notes and stock documents are free-form ledgers.
      break
  }
}

export function voucherTypeCode(type: VoucherType): string {
  return type.split('_').map((p) => p[0]).join('')
}
