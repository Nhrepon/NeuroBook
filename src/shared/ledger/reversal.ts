// Build the reversal voucher for a posted voucher (R1).
// The reversal flips every line's debit/credit; the result is a NEW draft
// voucher whose sequence number is assigned at post by the same R3 path.
import type { JournalEntry, Voucher } from '../types'

export interface ReversalInput {
  original: Pick<Voucher, 'date' | 'narration' | 'voucherType' | 'entries'>
  reversalDate: string
  reversedByUserId: string
  reason?: string
}

export interface ReversalDraft {
  date: string
  narration: string
  voucherType: Voucher['voucherType']
  entries: JournalEntry[]
}

export function buildReversal(input: ReversalInput): ReversalDraft {
  const flipped: JournalEntry[] = input.original.entries.map((e) => ({
    accountId: e.accountId,
    accountType: e.accountType,
    debit: e.credit,    // swap
    credit: e.debit,    // swap
    reference: e.reference,
  }))

  const reasonSuffix = input.reason ? ` — ${input.reason}` : ''
  return {
    date: input.reversalDate,
    narration: `Reversal of: ${input.original.narration}${reasonSuffix}`,
    voucherType: input.original.voucherType,
    entries: flipped,
  }
}
