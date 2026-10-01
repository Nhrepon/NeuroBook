// Pre-flight validation for posting a voucher. Pure function: same input,
// same result, on web or mobile. The DB transaction wraps this with
// sequence assignment and the journal write (R3, R4, R8).
import { sumDebit, sumCredit } from '../money'
import { LedgerError, LedgerErrorCode } from './errors'
import type { JournalEntry, Voucher, VoucherStatus } from '../types'

export interface PostValidationInput {
  entries: JournalEntry[]
  status: VoucherStatus
  periodClosed?: boolean
}

export interface PostValidationResult {
  totalDebit: number
  totalCredit: number
}

export function validateForPost(input: PostValidationInput): PostValidationResult {
  const { entries, status, periodClosed } = input

  if (status === 'posted') {
    throw new LedgerError(
      LedgerErrorCode.IMMUTABLE,
      'Voucher is already posted; use reversal to correct.',
    )
  }
  if (status === 'reversed') {
    throw new LedgerError(
      LedgerErrorCode.IMMUTABLE,
      'Reversed vouchers cannot be posted again.',
    )
  }
  if (periodClosed) {
    throw new LedgerError(
      LedgerErrorCode.PERIOD_LOCKED,
      'This fiscal period is closed. Only an admin can reopen it.',
    )
  }
  if (entries.length < 2) {
    throw new LedgerError(
      LedgerErrorCode.VALIDATION,
      'A voucher must have at least two journal entries.',
      'entries',
    )
  }

  const totalDebit = sumDebit(entries)
  const totalCredit = sumCredit(entries)

  for (const e of entries) {
    if (e.debit < 0 || e.credit < 0) {
      throw new LedgerError(
        LedgerErrorCode.VALIDATION,
        'Debit and credit amounts must be non-negative.',
        'entries',
      )
    }
    if (e.debit > 0 && e.credit > 0) {
      throw new LedgerError(
        LedgerErrorCode.VALIDATION,
        'A journal line cannot have both debit and credit.',
        'entries',
      )
    }
  }

  if (totalDebit !== totalCredit) {
    throw new LedgerError(
      LedgerErrorCode.UNBALANCED,
      `Debits (${totalDebit}) do not equal credits (${totalCredit}).`,
      'entries',
    )
  }
  if (totalDebit === 0) {
    throw new LedgerError(
      LedgerErrorCode.VALIDATION,
      'A voucher cannot be posted with zero total.',
      'entries',
    )
  }

  return { totalDebit, totalCredit }
}

/** Compute totals for an in-memory voucher. */
export function computeTotals(v: Pick<Voucher, 'entries'>): {
  totalDebit: number
  totalCredit: number
} {
  return {
    totalDebit: sumDebit(v.entries),
    totalCredit: sumCredit(v.entries),
  }
}
