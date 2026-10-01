// Pure model behind the new-voucher form (U1, §5.3).
//
// The component renders; this file decides. Everything that answers a question
// - what a half-filled row becomes, which account type a line may take, whether
// the voucher may be saved - lives here as a plain function, because the web app
// has no React testing library and a rule buried in a component is a rule that
// cannot be tested at all. The form and the server end up agreeing because both
// ask the same shared validators rather than reimplementing them.
import {
  allowedTypesFor,
  validateVoucherShape,
  voucherTypeSpec,
  invoicePathFor,
} from '@neurobook/shared/ledger'
import { formatTakaFromMinor } from '@neurobook/shared/format'
import type { AccountType, VoucherType } from '@neurobook/shared'

export interface AccountOpt {
  id: string
  code: string
  name: string
  type: AccountType
}

/** One visual row: an optional debit side and an optional credit side. */
export interface Row {
  key: number
  debitAccountId: string
  /** Raw text, not a number: `12.` must survive long enough to become `12.50`. */
  debitText: string
  creditAccountId: string
  creditText: string
}

/** The flat line the server expects. */
export interface Entry {
  accountId: string
  accountType: AccountType
  debit: number
  credit: number
}

export function blankRow(key: number): Row {
  return { key, debitAccountId: '', debitText: '', creditAccountId: '', creditText: '' }
}

const MINOR_ALLOWED = /^\d*\.?\d*$/

/**
 * Major-unit text -> minor units, tolerant of how people actually type.
 *
 * Returns 0 rather than NaN for anything unparsable: a bad amount must never
 * reach the ledger as `NaN`, and the row-level "amount but no account" checks
 * already report an empty side. `12.` parses, because a controlled input that
 * rejects the intermediate state makes `12.50` impossible to type.
 */
export function parseMinor(text: string): number {
  const cleaned = text.replace(/[,৳\s]/g, '')
  if (cleaned === '' || cleaned === '.') return 0
  if (!MINOR_ALLOWED.test(cleaned)) return 0
  const major = Number(cleaned)
  if (!Number.isFinite(major) || major < 0) return 0
  // +EPSILON absorbs the usual binary-float shortfalls (12.34 -> 1234, not 1233).
  return Math.round(major * 100 + Number.EPSILON)
}

/** Normalise a row's amount on blur so the footer sums what will be posted. */
export function formatMinorInput(minor: number): string {
  return minor === 0 ? '' : (minor / 100).toFixed(2)
}

/**
 * Collapse the two-sided rows into the flat JournalEntry[] the server expects.
 *
 * A side with no account chosen, or no amount, is dropped entirely - a
 * half-filled row must not become a 0/0 journal line, and a zero amount is not a
 * posting. Anything dropped is reported by `clientProblems`, so nothing
 * disappears silently.
 *
 * The account TYPE is resolved from the chart rather than carried on the row:
 * the row only holds an id, and the type is whatever that account is. Sending a
 * guessed type would let a REVENUE account post as ASSET, which still balances
 * and still corrupts the trial balance.
 */
export function toEntries(rows: Row[], accounts: AccountOpt[]): Entry[] {
  const typeOf = new Map(accounts.map((a) => [a.id, a.type]))
  const out: Entry[] = []
  for (const r of rows) {
    const dType = typeOf.get(r.debitAccountId)
    const dAmount = parseMinor(r.debitText)
    if (r.debitAccountId && dType && dAmount > 0) {
      out.push({ accountId: r.debitAccountId, accountType: dType, debit: dAmount, credit: 0 })
    }
    const cType = typeOf.get(r.creditAccountId)
    const cAmount = parseMinor(r.creditText)
    if (r.creditAccountId && cType && cAmount > 0) {
      out.push({ accountId: r.creditAccountId, accountType: cType, debit: 0, credit: cAmount })
    }
  }
  return out
}

/** Sums of what will actually post — the footer's figures. */
export function totals(
  rows: Row[],
  accounts: AccountOpt[],
): { debit: number; credit: number; difference: number } {
  const entries = toEntries(rows, accounts)
  let debit = 0
  let credit = 0
  for (const e of entries) {
    debit += e.debit
    credit += e.credit
  }
  return { debit, credit, difference: debit - credit }
}

/**
 * Rows whose chosen account the current voucher type may not use.
 *
 * Switching PAYMENT -> CONTRA leaves an EXPENSE id sitting in the row: the
 * picker's option list no longer contains it, so the select renders blank, but
 * the state still holds it and `toEntries` would happily post it. Surfacing it
 * is the difference between "your voucher was rejected" and "line 2 needs
 * re-picking".
 */
export function staleSelections(
  rows: Row[],
  type: VoucherType,
  accounts: AccountOpt[],
): Array<{ line: number; side: 'debit' | 'credit'; account: AccountOpt }> {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const out: Array<{ line: number; side: 'debit' | 'credit'; account: AccountOpt }> = []
  rows.forEach((r, i) => {
    const sides = [
      ['debit', r.debitAccountId],
      ['credit', r.creditAccountId],
    ] as const
    for (const [side, id] of sides) {
      if (!id) continue
      const account = byId.get(id)
      if (!account) continue
      const allowed = allowedTypesFor(type, side)
      if (allowed && !allowed.includes(account.type)) {
        out.push({ line: i + 1, side, account })
      }
    }
  })
  return out
}
export interface ClientProblemInput {
  type: VoucherType
  date: string
  narration: string
  rows: Row[]
  accounts: AccountOpt[]
}

/**
 * Everything that blocks a save, in the order an accountant would fix them.
 *
 * An empty array means "may submit". These are the same validators the server
 * runs, so a rejection is decided at entry time rather than the outcome of a
 * round trip - the property §5.3 already promises the mobile client, and the
 * web form was the one surface not honouring it.
 */
export function clientProblems(input: ClientProblemInput): string[] {
  const { type, date, narration, rows, accounts } = input
  const problems: string[] = []

  // A document type does not belong on this form at all. Two bare account lines
  // would produce a sales invoice with no VAT split, no `invoices` row and no
  // Mushak 6.2 — indistinguishable on screen from a correct one, and an audit
  // failure. `invoicePathFor` points at the form that can actually produce it.
  const invoicePath = invoicePathFor(type)
  if (invoicePath) {
    problems.push(`${voucherTypeSpec(type).label} is entered on the invoice form, not here.`)
    return problems
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) problems.push('Pick a date.')
  if (!narration.trim()) problems.push('Narration is required - say what this voucher is for.')

  // Half-filled sides first: they are what makes the balance wrong, and the
  // specific complaint is more useful than "out of balance".
  rows.forEach((r, i) => {
    const line = i + 1
    const sides = [
      ['debit', r.debitAccountId, r.debitText],
      ['credit', r.creditAccountId, r.creditText],
    ] as const
    for (const [side, accountId, text] of sides) {
      const amount = parseMinor(text)
      if (accountId && amount <= 0) {
        problems.push(`Line ${line} - the ${side} has an account but no amount.`)
      }
      if (!accountId && amount > 0) {
        problems.push(`Line ${line} - the ${side} has an amount but no account.`)
      }
    }
  })

  for (const s of staleSelections(rows, type, accounts)) {
    problems.push(
      `Line ${s.line} - ${s.account.name} may not be ${s.side === 'debit' ? 'debited' : 'credited'} ` +
        `on a ${voucherTypeSpec(type).label.toLowerCase()}.`,
    )
  }

  const entries = toEntries(rows, accounts)
  if (entries.length < 2) {
    problems.push('A voucher needs at least two lines - one debit and one credit.')
    return problems
  }

  const { difference } = totals(rows, accounts)
  if (difference !== 0) {
    problems.push(`Debits and credits differ by ${formatTakaFromMinor(Math.abs(difference))}.`)
  }

  // §5.3 structural rules - the same call the draft-save action and the post
  // path make, so the message shown is the message the server would send.
  problems.push(...validateVoucherShape({ type, entries }))

  return problems
}

