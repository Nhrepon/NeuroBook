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
    if (e.debit > 0 && e.credit > 0) throw new Error('VALIDATION: entry cannot have both debit and credit')
  }
  if (!isBalanced(input.entries)) throw new Error('UNBALANCED: total debit must equal total credit')
}

export function assertVoucherShape(_input: { type: VoucherType; entries: JournalEntry[] }): void {
  // Structural rules per voucher type can be expanded; placeholder for now.
  return
}

export function voucherTypeCode(type: VoucherType): string {
  return type.split('_').map((p) => p[0]).join('')
}
