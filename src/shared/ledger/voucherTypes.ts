// Voucher type registry and per-type structural rules (§5.3).
//
// The enum in ../types says *which* kinds exist; this module says what each
// one is *allowed to mean*. Without it, `CONTRA` (bank-to-bank) and `JOURNAL`
// (anything at all) are indistinguishable to the ledger, so a bank-to-bank
// transfer typed against two expense accounts posts without complaint and the
// cash position silently drifts.
//
// Everything here is pure: no I/O, no DB, no React. The same rules run in the
// web post path, in the mobile offline pre-flight, and in tests.
import { LedgerError, LedgerErrorCode } from './errors'
import type { AccountType, JournalEntry, VoucherType } from '../types'

export type VoucherCategory =
  | 'cash'          // money out of / into a cash or bank account
  | 'contra'        // movement between two of your own money accounts
  | 'journal'       // free-form reclassification
  | 'invoice'       // raises a receivable or a payable
  | 'note'          // adjusts an existing invoice
  | 'stock'         // inventory movement between warehouses
  | 'adjustment'    // housekeeping (cheque cancellation, rounding, reclass)

/** Which way money moves, relative to the company's own cash/bank accounts. */
export type VoucherDirection = 'out' | 'in' | 'internal' | 'none'

/**
 * Where a type may be entered — the answer to "which form owns this?".
 *
 * Exactly one path per type, deliberately. A sales invoice used to be
 * creatable both from the invoice form (line items, VAT/SD, an `invoices` row
 * and a Mushak 6.2 PDF) and from the generic voucher form (two hand-picked
 * account lines, no VAT split, no invoice row). The second produced a document
 * that looks finished in the UI and fails an NBR audit. Collapsing the choice
 * to one owner is what removes that.
 */
export type VoucherEntry = 'voucher' | 'invoice'

/**
 * Which group of types a picker shows together. Presentation only — it never
 * changes what a voucher may contain; `validateVoucherShape` still decides
 * that.
 */
export type VoucherGroup = 'money' | 'document' | 'journal' | 'stock'

export interface VoucherTypeSpec {
  type: VoucherType
  label: string
  /** §5.3's one-line description — what this voucher is for. Short enough for a menu; `rule` is the long validation text. */
  summary: string
  /** Prefix for the gapless sequence number (R3) — what the accountant reads. */
  shortCode: string
  category: VoucherCategory
  direction: VoucherDirection
  /** Which form owns this type. Single-valued: see `VoucherEntry`. */
  entry: VoucherEntry
  group: VoucherGroup
  /** A ledger with a party (customer/supplier) must reference one. */
  partyRequired: boolean
  /**
   * Asset-to-asset only: exactly one debit and one credit, both ASSET, on two
   * *different* accounts. CONTRA and TRANSFER are the money-internal moves;
   * everything else may touch P&L and control accounts.
   */
  assetPairOnly: boolean
  /** Human explanation used in validation messages. */
  rule: string
}

const MONEY_ACCOUNTS = 'the cash or bank account'
const PARTY_ACCOUNTS = 'the customer/supplier control account'

/** Accounts whose balance is a customer/supplier money claim. */
const CONTROL_TYPES: AccountType[] = ['LIABILITY']
/** Real-accounts money: cash at hand and at bank. */
const MONEY_TYPES: AccountType[] = ['ASSET']
export const VOUCHER_TYPES: Record<VoucherType, VoucherTypeSpec> = {
  PAYMENT: {
    type: 'PAYMENT',
    label: 'Payment',
    summary: 'Cash/Bank payment to a party',
    shortCode: 'PAY',
    category: 'cash',
    entry: 'voucher',
    group: 'money',
    direction: 'out',
    partyRequired: true,
    assetPairOnly: false,
    rule: `Debit ${PARTY_ACCOUNTS} or an expense, credit ${MONEY_ACCOUNTS}.`,
  },
  RECEIPT: {
    type: 'RECEIPT',
    label: 'Receipt',
    summary: 'Cash/Bank receipt from a party',
    shortCode: 'REC',
    category: 'cash',
    direction: 'in',
    entry: 'voucher',
    group: 'money',
    partyRequired: true,
    assetPairOnly: false,
    rule: `Debit ${MONEY_ACCOUNTS}, credit ${PARTY_ACCOUNTS} or income.`,
  },
  JOURNAL: {
    type: 'JOURNAL',
    label: 'Journal',
    summary: 'Manual journal entry',
    shortCode: 'JRN',
    category: 'journal',
    direction: 'none',
    entry: 'voucher',
    group: 'journal',
    partyRequired: false,
    assetPairOnly: false,
    rule: 'Any balanced reclassification between accounts.',
  },
  SALES_INVOICE: {
    type: 'SALES_INVOICE',
    label: 'Sales invoice',
    summary: 'Customer invoice (with VAT / TDS)',
    shortCode: 'SI',
    category: 'invoice',
    entry: 'invoice',
    group: 'document',
    direction: 'none',
    partyRequired: true,
    assetPairOnly: false,
    rule: `Debit ${PARTY_ACCOUNTS}, credit revenue.`,
  },
  PURCHASE_INVOICE: {
    type: 'PURCHASE_INVOICE',
    label: 'Purchase invoice',
    summary: 'Supplier bill (with VAT / TDS)',
    shortCode: 'PI',
    category: 'invoice',
    entry: 'invoice',
    group: 'document',
    direction: 'none',
    partyRequired: true,
    assetPairOnly: false,
    rule: `Debit expense or inventory, credit ${PARTY_ACCOUNTS}.`,
  },
  DEBIT_NOTE: {
    type: 'DEBIT_NOTE',
    label: 'Debit note (customer)',
    summary: 'Customer debit note',
    shortCode: 'DN',
    category: 'note',
    entry: 'invoice',
    group: 'document',
    direction: 'none',
    partyRequired: true,
    assetPairOnly: false,
    rule: `A customer debit note REDUCES what the customer owes: debit ${PARTY_ACCOUNTS}, credit revenue.`,
  },
  CREDIT_NOTE: {
    type: 'CREDIT_NOTE',
    label: 'Credit note (supplier)',
    summary: 'Supplier credit note',
    shortCode: 'CN',
    category: 'note',
    entry: 'invoice',
    group: 'document',
    direction: 'none',
    partyRequired: true,
    assetPairOnly: false,
    rule: `A supplier credit note REDUCES what we owe: debit expense or inventory, credit ${PARTY_ACCOUNTS}.`,
  },
  CONTRA: {
    type: 'CONTRA',
    label: 'Contra',
    summary: 'Bank-to-bank / cash-to-bank transfer',
    shortCode: 'CTR',
    category: 'contra',
    entry: 'voucher',
    group: 'money',
    direction: 'internal',
    partyRequired: false,
    assetPairOnly: true,
    rule: 'Bank-to-bank or cash-to-bank: one ASSET debited, a different ASSET credited.',
  },
  REFUND: {
    type: 'REFUND',
    label: 'Refund',
    summary: 'Refund to customer/supplier',
    shortCode: 'REF',
    category: 'cash',
    entry: 'voucher',
    group: 'money',
    direction: 'out',
    partyRequired: true,
    assetPairOnly: false,
    rule: `Money returned to a customer: debit ${PARTY_ACCOUNTS} or a sales-return account, credit ${MONEY_ACCOUNTS}.`,
  },
  TRANSFER: {
    type: 'TRANSFER',
    label: 'Transfer',
    summary: 'Cash/Bank transfer between accounts',
    shortCode: 'TRF',
    category: 'contra',
    entry: 'voucher',
    group: 'money',
    direction: 'internal',
    partyRequired: false,
    assetPairOnly: true,
    rule: 'Cash/bank transfer between two of your own accounts: one ASSET debited, a different ASSET credited.',
  },
  STOCK_TRANSFER: {
    type: 'STOCK_TRANSFER',
    label: 'Stock transfer',
    summary: 'Transfer between warehouses',
    shortCode: 'STK',
    category: 'stock',
    direction: 'internal',
    entry: 'voucher',
    group: 'stock',
    partyRequired: false,
    assetPairOnly: false,
    rule: 'Inventory between warehouses: debit the receiving stock account, credit the issuing one.',
  },
  ADJUSTMENT: {
    type: 'ADJUSTMENT',
    label: 'Adjustment',
    summary: 'Manual adjustment of ledger balance',
    shortCode: 'ADJ',
    category: 'adjustment',
    direction: 'none',
    entry: 'voucher',
    group: 'journal',
    partyRequired: false,
    assetPairOnly: false,
    rule: 'Housekeeping entry (cheque cancellation, rounding, reclassification).',
  },
}

/** Stable display order for pickers and the list filter. */
export const VOUCHER_TYPE_ORDER: VoucherType[] = [
  'PAYMENT',
  'RECEIPT',
  'CONTRA',
  'TRANSFER',
  'SALES_INVOICE',
  'PURCHASE_INVOICE',
  'DEBIT_NOTE',
  'CREDIT_NOTE',
  'REFUND',
  'STOCK_TRANSFER',
  'JOURNAL',
  'ADJUSTMENT',
]

export function isVoucherType(value: string): value is VoucherType {
  return Object.prototype.hasOwnProperty.call(VOUCHER_TYPES, value)
}

export interface VoucherGroupSpec {
  group: VoucherGroup
  label: string
  /** Shown under the group heading so a picker explains itself. */
  hint: string
}

/**
 * Group order for pickers.
 *
 * Money first because it is the common case and needs no document machinery;
 * documents next because they are owned by the invoice form; journal last
 * because it is the escape hatch. Presentation only — this never changes what
 * a voucher may contain.
 */
export const VOUCHER_GROUP_ORDER: VoucherGroupSpec[] = [
  {
    group: 'money',
    label: 'Money in and out',
    hint: 'Payments, receipts, refunds and transfers between your own accounts.',
  },
  {
    group: 'document',
    label: 'Documents',
    hint: 'Sales and purchase documents. Entered on the invoice form, which handles VAT, SD and the NBR print.',
  },
  {
    group: 'journal',
    label: 'Adjustments',
    hint: 'Free-form entries for reclassification, rounding and corrections.',
  },
  {
    group: 'stock',
    label: 'Stock',
    hint: 'Inventory movements between warehouses.',
  },
]

/** Types owned by one entry path, in registry order. */
export function voucherTypesForEntry(entry: VoucherEntry): VoucherType[] {
  return VOUCHER_TYPE_ORDER.filter((t) => VOUCHER_TYPES[t].entry === entry)
}

/** Types in one group, in registry order. */
export function voucherTypesInGroup(group: VoucherGroup): VoucherType[] {
  return VOUCHER_TYPE_ORDER.filter((t) => VOUCHER_TYPES[t].group === group)
}

/**
 * The canonical form for a type, or `null` when the voucher form owns it.
 *
 * The voucher form calls this to refuse a document type and send the user
 * somewhere that can actually produce a compliant document. Without it a sales
 * invoice can be typed as two bare account lines: no VAT split, no `invoices`
 * row, no Mushak 6.2 — a document that looks finished and fails an audit.
 */
export function invoicePathFor(type: VoucherType): string | null {
  return VOUCHER_TYPES[type].entry === 'invoice'
    ? `/invoices/new?type=${type}`
    : null
}

export function voucherTypeSpec(type: VoucherType): VoucherTypeSpec {
  return VOUCHER_TYPES[type]
}

export function voucherTypeLabel(type: VoucherType): string {
  return VOUCHER_TYPES[type]?.label ?? type
}
export interface VoucherShapeInput {
  type: VoucherType
  entries: JournalEntry[]
  /**
   * When the caller can tell, say so: it lets the party rule fire on the
   * control accounts that actually represent a customer/supplier rather than
   * on every liability in the chart (VAT payable is a liability but is not a
   * party). Optional - the shape check degrades to the type rules alone.
   */
  hasPartyReference?: boolean
}

/**
 * Structural validation for a voucher type: *what the entries mean*, as
 * opposed to `validateForPost`, which only asks whether they add up.
 *
 * Returns every problem found rather than the first, because the voucher form
 * shows them all at once and an accountant fixing a typo does not want to
 * rediscover the same mistake three times.
 */
export function validateVoucherShape(input: VoucherShapeInput): string[] {
  const spec = VOUCHER_TYPES[input.type]
  const entries = input.entries
  const problems: string[] = []

  if (!spec) return [`Unknown voucher type: ${String(input.type)}`]

  const debits = entries.filter((e) => e.debit > 0)
  const credits = entries.filter((e) => e.credit > 0)

  // --- Money types must actually move money, and in the right direction.
  if (spec.direction === 'in' || spec.direction === 'out') {
    const expectedOn: 'debit' | 'credit' = spec.direction === 'in' ? 'debit' : 'credit'
    const actualOn = expectedOn === 'debit' ? debits : credits
    const moneyOnExpectedSide = actualOn.filter((e) => MONEY_TYPES.includes(e.accountType))
    if (moneyOnExpectedSide.length === 0) {
      problems.push(
        `A ${spec.label} ${expectedOn === 'debit' ? 'debits' : 'credits'} ${MONEY_ACCOUNTS}, ` +
          `so at least one ${expectedOn} line must be an ASSET.`,
      )
    }
    // The opposite side must not also be money - that would be a contra,
    // mislabelled as a payment, and it hides the movement from the party.
    const opposite = expectedOn === 'debit' ? credits : debits
    const strayMoney = opposite.filter((e) => MONEY_TYPES.includes(e.accountType))
    if (strayMoney.length > 0) {
      problems.push(
        `The other side of a ${spec.label} must not be another cash/bank account - ` +
          `that is a Contra or Transfer. Found: ${strayMoney.map((e) => e.accountId).join(', ')}.`,
      )
    }
  }
  // --- Contra / Transfer: asset-to-asset on two different accounts only.
  if (spec.assetPairOnly) {
    if (debits.length !== 1 || credits.length !== 1) {
      problems.push(
        `A ${spec.label} is a single transfer between two accounts: exactly one debit ` +
          `and one credit line, not ${debits.length} debit(s) and ${credits.length} credit(s).`,
      )
    }
    const bad = entries.filter((e) => !MONEY_TYPES.includes(e.accountType))
    if (bad.length > 0) {
      problems.push(
        `A ${spec.label} moves money between cash/bank accounts only. Not allowed here: ` +
          bad.map((e) => `${e.accountId} (${e.accountType})`).join(', ') + '.',
      )
    }
    if (debits.length === 1 && credits.length === 1 &&
        debits[0]!.accountId === credits[0]!.accountId) {
      problems.push('A transfer must be between two different accounts.')
    }
  }

  // --- Sales side: revenue must be credited. Purchase side: cost debited.
  if (input.type === 'SALES_INVOICE' || input.type === 'DEBIT_NOTE') {
    const revenueCredit = credits.filter((e) => e.accountType === 'REVENUE')
    if (revenueCredit.length === 0) {
      problems.push(
        input.type === 'SALES_INVOICE'
          ? 'A sales invoice credits a REVENUE account; none was credited.'
          : 'A customer debit note credits a REVENUE account; none was credited.',
      )
    }
  }
  if (input.type === 'PURCHASE_INVOICE' || input.type === 'CREDIT_NOTE') {
    const costDebit = debits.filter((e) => e.accountType === 'EXPENSE' || e.accountType === 'ASSET')
    if (costDebit.length === 0) {
      problems.push(
        input.type === 'PURCHASE_INVOICE'
          ? 'A purchase invoice debits an EXPENSE or inventory (ASSET) account; none was debited.'
          : 'A supplier credit note debits an EXPENSE or inventory (ASSET) account; none was debited.',
      )
    }
  }
  // --- Stock transfer: inventory in, inventory out.
  if (input.type === 'STOCK_TRANSFER') {
    const onDebit = debits.filter((e) => e.accountType === 'ASSET')
    const onCredit = credits.filter((e) => e.accountType === 'ASSET')
    if (onDebit.length === 0 || onCredit.length === 0) {
      problems.push(
        'A stock transfer moves inventory: an ASSET account must be debited (receiving ' +
          'warehouse) and another credited (issuing warehouse).',
      )
    } else if (
      onDebit.length === 1 &&
      onCredit.length === 1 &&
      onDebit[0]!.accountId === onCredit[0]!.accountId
    ) {
      // The message above promises "another" account on the credit side, so
      // hold it to that. Without this, stock issued out of warehouse-a and
      // straight back into warehouse-a balances, posts, and burns a sequence
      // number on an entry that moved nothing.
      problems.push(
        'A stock transfer must be between two different accounts - debit and ' +
          'credit cannot be the same warehouse.',
      )
    }
  }

  // --- Party-bearing types need a party control account when we can tell.
  if (spec.partyRequired && input.hasPartyReference === true) {
    const control = entries.filter((e) => CONTROL_TYPES.includes(e.accountType))
    if (control.length === 0) {
      problems.push(
        `A ${spec.label} affects a customer or supplier, so one line must be a control ` +
          '(liability) account - no liability was debited or credited.',
      )
    }
  }

  return problems
}

/**
 * `validateVoucherShape` as an assertion, for the write paths. Uses
 * VALIDATION so it maps onto the 400 branch of the REST envelope rather than
 * reading as a server fault.
 */
export function assertVoucherShape(input: VoucherShapeInput): void {
  const problems = validateVoucherShape(input)
  if (problems.length > 0) {
    throw new LedgerError(
      LedgerErrorCode.VALIDATION,
      problems.join(' '),
      'entries',
    )
  }
}
/**
 * Which side of the voucher a customer/supplier control account belongs on.
 *
 * A payment settles what you owe, so it DEBITS the payable and credits cash.
 * A receipt settles what they owe you, so it does the reverse. Getting this
 * backwards is the single most common voucher-entry mistake, and it produces
 * a voucher that balances perfectly while leaving the party balance stranded
 * - so the form uses this to pre-side the line instead of making the user
 * remember it.
 *
 * `null` for types that have no party side (Journal, Adjustment, Stock
 * Transfer, and the asset-to-asset Contra/Transfer).
 */
export function partySideFor(type: VoucherType): 'debit' | 'credit' | null {
  switch (type) {
    case 'PAYMENT':
    case 'PURCHASE_INVOICE':
    case 'CREDIT_NOTE':
      // Reduce what WE owe -> debit the payable.
      return 'debit'
    case 'RECEIPT':
    case 'SALES_INVOICE':
    case 'DEBIT_NOTE':
    case 'REFUND':
      // Reduce what THEY owe -> credit the receivable.
      return 'credit'
    case 'JOURNAL':
    case 'CONTRA':
    case 'TRANSFER':
    case 'STOCK_TRANSFER':
    case 'ADJUSTMENT':
      return null
  }
}

/**
 * The account types allowed on each side, for the voucher form to narrow its
 * pickers. `null` means "no constraint beyond the double-entry rule".
 */
export function allowedTypesFor(
  type: VoucherType,
  side: 'debit' | 'credit',
): AccountType[] | null {
  const spec = VOUCHER_TYPES[type]
  if (!spec) return null
  if (spec.assetPairOnly) return ['ASSET']

  if (spec.direction === 'in') {
    return side === 'debit' ? ['ASSET'] : null
  }
  if (spec.direction === 'out') {
    return side === 'credit' ? ['ASSET'] : null
  }
  if (type === 'SALES_INVOICE' || type === 'DEBIT_NOTE') {
    return side === 'credit' ? ['REVENUE'] : null
  }
  if (type === 'PURCHASE_INVOICE' || type === 'CREDIT_NOTE') {
    return side === 'debit' ? ['EXPENSE', 'ASSET'] : null
  }
  if (type === 'STOCK_TRANSFER') return ['ASSET']
  return null
}
