import type { Voucher, JournalEntry } from './types'

export function buildReversal(original: Pick<Voucher, 'date' | 'narration' | 'voucherType' | 'entries'>): {
  voucherType: Voucher['voucherType']
  date: string
  narration: string
  entries: JournalEntry[]
} {
  return {
    voucherType: original.voucherType,
    date: original.date,
    narration: `Reversal of: ${original.narration}`,
    entries: original.entries.map((e) => ({ ...e, debit: e.credit, credit: e.debit })),
  }
}
