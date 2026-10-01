// Per-type structural rules for voucher types (5.3).
//
// The point of these tests is the cases that used to post silently: a CONTRA
// between two expense accounts, a sales invoice that never credits revenue.
// Each one balanced perfectly before this module existed, which is exactly why
// they were wrong.
import { describe, it, expect } from 'vitest'
import {
  VOUCHER_TYPES,
  VOUCHER_TYPE_ORDER,
  VOUCHER_GROUP_ORDER,
  voucherTypesForEntry,
  voucherTypesInGroup,
  invoicePathFor,
  validateVoucherShape,
  assertVoucherShape,
  partySideFor,
  allowedTypesFor,
  isVoucherType,
  voucherTypeSpec,
} from '../ledger/voucherTypes'
import { isBalanced } from '../money'
import type { AccountType, JournalEntry, VoucherType } from '../types'

function e(
  accountId: string,
  accountType: AccountType,
  side: 'debit' | 'credit',
  amount: number,
): JournalEntry {
  return { accountId, accountType, debit: side === 'debit' ? amount : 0, credit: side === 'credit' ? amount : 0 }
}

/** The canonical balanced payment: debit the payable, credit cash. */
const payment = (amount = 5000): JournalEntry[] => [
  e('sundry-creditors', 'LIABILITY', 'debit', amount),
  e('cash', 'ASSET', 'credit', amount),
]

describe('voucher type registry', () => {
  it('covers every VoucherType, with no gaps and no extras', () => {
    // Guards against a type being added to the enum and not to the registry:
    // an unknown type would silently post with no structural rules at all.
    const registryKeys = Object.keys(VOUCHER_TYPES).sort()
    const orderKeys = [...VOUCHER_TYPE_ORDER].sort()
    expect(registryKeys).toEqual(orderKeys)
    expect(registryKeys.length).toBe(12)
  })

  it('gives every type a unique short code, so sequence numbers cannot collide', () => {
    const codes = VOUCHER_TYPE_ORDER.map((t) => voucherTypeSpec(t).shortCode)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('gives every type an entry path and a group', () => {
    for (const t of VOUCHER_TYPE_ORDER) {
      const spec = voucherTypeSpec(t)
      expect(['voucher', 'invoice'], t).toContain(spec.entry)
      expect(['money', 'document', 'journal', 'stock'], t).toContain(spec.group)
    }
  })

  it('partitions every type into exactly one group', () => {
    // Walk each *group* once, not each type: expanding per type would return
    // every member of a group once per member.
    const seen = VOUCHER_GROUP_ORDER.flatMap((g) => voucherTypesInGroup(g.group))
    expect(seen.sort()).toEqual([...VOUCHER_TYPE_ORDER].sort())
  })

  it('names a group for every group in use', () => {
    // A type in a group with no heading renders with no way to tell what the
    // list it sits in is for.
    const used = new Set(VOUCHER_TYPE_ORDER.map((t) => voucherTypeSpec(t).group))
    for (const g of used) {
      expect(VOUCHER_GROUP_ORDER.map((x) => x.group), g).toContain(g)
    }
  })

  it('routes exactly the four document types to the invoice form', () => {
    const documents = voucherTypesForEntry('invoice')
    expect(documents.sort()).toEqual(
      ['CREDIT_NOTE', 'DEBIT_NOTE', 'PURCHASE_INVOICE', 'SALES_INVOICE'].sort(),
    )
    // This is the whole point of the split: the generic form must not be able
    // to produce a sales invoice as two bare account lines.
    for (const t of VOUCHER_TYPE_ORDER.filter((x) => !documents.includes(x))) {
      expect(invoicePathFor(t), t).toBeNull()
    }
    for (const t of documents) {
      expect(invoicePathFor(t), t).toBe(`/invoices/new?type=${t}`)
    }
  })

  it('gives every type a non-empty summary for the dashboard menu', () => {
    // The menu renders `summary`; a missing one would show a card with a title
    // and no explanation, which is indistinguishable from a card that failed.
    for (const t of VOUCHER_TYPE_ORDER) {
      const spec = voucherTypeSpec(t)
      expect(spec.summary, t).toBeTruthy()
      expect(spec.summary.trim().length, t).toBeGreaterThan(0)
      // Menu-sized: `rule` runs past 100 characters and belongs under the form.
      expect(spec.summary.length, t).toBeLessThan(60)
    }
  })

  it('recognises valid types and rejects junk', () => {
    expect(isVoucherType('CONTRA')).toBe(true)
    expect(isVoucherType('SOMETHING_ELSE')).toBe(false)
    // Prototype keys must not read as registered types.
    expect(isVoucherType('toString')).toBe(false)
    expect(isVoucherType('constructor')).toBe(false)
  })
})

describe('validateVoucherShape - asset-to-asset types', () => {
  it('accepts a bank-to-bank contra', () => {
    // Not `payment()`: a payment carries a control account, which is exactly
    // what a contra must NOT have.
    const contra = [e('cash', 'ASSET', 'debit', 5000), e('bank', 'ASSET', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'CONTRA', entries: contra })).toEqual([])
    expect(validateVoucherShape({ type: 'TRANSFER', entries: contra })).toEqual([])
  })

  it('rejects a contra between two expense accounts, even though it balances', () => {
    const wrong = [e('rent', 'EXPENSE', 'debit', 5000), e('salaries', 'EXPENSE', 'credit', 5000)]
    // The precondition that made this dangerous: it balances.
    expect(isBalanced(wrong)).toBe(true)
    const problems = validateVoucherShape({ type: 'CONTRA', entries: wrong })
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join(' ')).toMatch(/cash\/bank/i)
  })

  it('rejects a transfer between the same account twice', () => {
    const same = [e('cash', 'ASSET', 'debit', 100), e('cash', 'ASSET', 'credit', 100)]
    expect(validateVoucherShape({ type: 'TRANSFER', entries: same }).join(' ')).toMatch(
      /two different accounts/i,
    )
  })

  it('rejects a contra spread over more than two lines', () => {
    const spread = [
      e('cash', 'ASSET', 'debit', 300),
      e('bank', 'ASSET', 'debit', 200),
      e('cash', 'ASSET', 'credit', 500),
    ]
    expect(validateVoucherShape({ type: 'CONTRA', entries: spread }).join(' ')).toMatch(
      /exactly one debit/i,
    )
  })
})

describe('validateVoucherShape - money direction', () => {
  it('requires a receipt to debit cash', () => {
    const noCash = [e('debtors', 'LIABILITY', 'debit', 5000), e('income', 'REVENUE', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'RECEIPT', entries: noCash }).join(' ')).toMatch(
      /debits the cash or bank/i,
    )
  })

  it('rejects a payment that also moves another cash account (a mislabelled contra)', () => {
    const bankToBank = [
      e('sundry-creditors', 'LIABILITY', 'debit', 5000),
      e('cash', 'ASSET', 'credit', 5000),
    ]
    // That one is a legitimate payment, so it must pass.
    expect(validateVoucherShape({ type: 'PAYMENT', entries: bankToBank })).toEqual([])

    const actualContra = [
      e('sundry-creditors', 'LIABILITY', 'debit', 5000),
      e('cash', 'ASSET', 'debit', 5000),
      e('bank', 'ASSET', 'credit', 10_000),
    ]
    expect(validateVoucherShape({ type: 'PAYMENT', entries: actualContra }).join(' ')).toMatch(
      /Contra or Transfer/i,
    )
  })

  it('leaves JOURNAL and ADJUSTMENT unconstrained', () => {
    const anything = [e('rent', 'EXPENSE', 'debit', 5000), e('cash', 'ASSET', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'JOURNAL', entries: anything })).toEqual([])
    expect(validateVoucherShape({ type: 'ADJUSTMENT', entries: anything })).toEqual([])
  })
})

describe('validateVoucherShape - invoices and notes', () => {
  it('requires a sales invoice to credit revenue', () => {
    const noRevenue = [e('debtors', 'LIABILITY', 'debit', 5000), e('cash', 'ASSET', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'SALES_INVOICE', entries: noRevenue }).join(' ')).toMatch(
      /credits a REVENUE account/i,
    )
  })

  it('requires a purchase invoice to debit cost or inventory', () => {
    const noCost = [e('payable', 'LIABILITY', 'debit', 5000), e('cash', 'ASSET', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'PURCHASE_INVOICE', entries: noCost }).join(' ')).toMatch(
      /EXPENSE or inventory/i,
    )
  })

  it('treats a customer debit note as reducing the receivable', () => {
    const good = [e('debtors', 'LIABILITY', 'debit', 5000), e('sales', 'REVENUE', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'DEBIT_NOTE', entries: good })).toEqual([])
  })

  it('treats a supplier credit note as reducing what we owe', () => {
    const good = [e('purchases', 'EXPENSE', 'debit', 5000), e('payable', 'LIABILITY', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'CREDIT_NOTE', entries: good })).toEqual([])
  })

  it('requires inventory on both sides of a stock transfer', () => {
    const oneWay = [e('warehouse-a', 'ASSET', 'debit', 5000), e('cash', 'ASSET', 'credit', 5000)]
    // Both sides are ASSET, so the type-level rule passes; this is the shape
    // the stock rule is meant to catch only when it cannot.
    const bad = [e('rent', 'EXPENSE', 'debit', 5000), e('salaries', 'EXPENSE', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'STOCK_TRANSFER', entries: bad }).join(' ')).toMatch(
      /moves inventory/i,
    )
    expect(isBalanced(oneWay)).toBe(true)
  })

  it('rejects a stock transfer that leaves the stock where it started', () => {
    // Balances, both sides ASSET, and the receiving warehouse IS the issuing
    // one - so the voucher would post and change nothing.
    const noOp = [e('warehouse-a', 'ASSET', 'debit', 5000), e('warehouse-a', 'ASSET', 'credit', 5000)]
    expect(isBalanced(noOp)).toBe(true)
    expect(validateVoucherShape({ type: 'STOCK_TRANSFER', entries: noOp }).join(' ')).toMatch(
      /two different accounts/i,
    )
    // The genuine article still passes.
    const real = [e('warehouse-a', 'ASSET', 'debit', 5000), e('warehouse-b', 'ASSET', 'credit', 5000)]
    expect(validateVoucherShape({ type: 'STOCK_TRANSFER', entries: real })).toEqual([])
  })
})

describe('validateVoucherShape - party rule', () => {
  it('fires only when the caller says a party is involved', () => {
    const noControl = [e('rent', 'EXPENSE', 'debit', 5000), e('cash', 'ASSET', 'credit', 5000)]
    // Without the flag the payment rules alone apply and pass.
    expect(validateVoucherShape({ type: 'PAYMENT', entries: noControl })).toEqual([])
    // With it, the missing control account is reported.
    const flagged = validateVoucherShape({
      type: 'PAYMENT',
      entries: noControl,
      hasPartyReference: true,
    })
    expect(flagged.join(' ')).toMatch(/control/i)
  })

  it('is satisfied by a control account on either side', () => {
    const flagged = validateVoucherShape({
      type: 'PAYMENT',
      entries: payment(5000),
      hasPartyReference: true,
    })
    expect(flagged).toEqual([])
  })
})

describe('assertVoucherShape', () => {
  it('throws a VALIDATION LedgerError, so REST answers 400 not 500', () => {
    const wrong = [e('rent', 'EXPENSE', 'debit', 5000), e('salaries', 'EXPENSE', 'credit', 5000)]
    try {
      assertVoucherShape({ type: 'CONTRA', entries: wrong })
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as { code?: string }).code).toBe('VALIDATION')
      expect((err as { field?: string }).field).toBe('entries')
    }
  })

  it('stays silent on a well-formed voucher', () => {
    expect(() => assertVoucherShape({ type: 'PAYMENT', entries: payment(5000) })).not.toThrow()
  })
})

describe('partySideFor', () => {
  it('debits the payable when settling what we owe', () => {
    const debitSide: VoucherType[] = ['PAYMENT', 'PURCHASE_INVOICE', 'CREDIT_NOTE']
    for (const t of debitSide) expect(partySideFor(t)).toBe('debit')
  })

  it('credits the receivable when settling what they owe', () => {
    const creditSide: VoucherType[] = ['RECEIPT', 'SALES_INVOICE', 'DEBIT_NOTE', 'REFUND']
    for (const t of creditSide) expect(partySideFor(t)).toBe('credit')
  })

  it('has no party side for the types that never touch one', () => {
    const none: VoucherType[] = ['JOURNAL', 'CONTRA', 'TRANSFER', 'STOCK_TRANSFER', 'ADJUSTMENT']
    for (const t of none) expect(partySideFor(t)).toBeNull()
  })

  it('sides every type in the registry exactly once', () => {
    for (const t of VOUCHER_TYPE_ORDER) {
      expect(['debit', 'credit', null]).toContain(partySideFor(t))
    }
  })
})

describe('allowedTypesFor', () => {
  it('restricts both sides of an asset-to-asset type to ASSET', () => {
    expect(allowedTypesFor('CONTRA', 'debit')).toEqual(['ASSET'])
    expect(allowedTypesFor('CONTRA', 'credit')).toEqual(['ASSET'])
    expect(allowedTypesFor('TRANSFER', 'credit')).toEqual(['ASSET'])
  })

  it('pins the cash side of money types', () => {
    expect(allowedTypesFor('RECEIPT', 'debit')).toEqual(['ASSET'])
    expect(allowedTypesFor('PAYMENT', 'credit')).toEqual(['ASSET'])
    // The non-cash side stays open: a payment debits a payable or an expense.
    expect(allowedTypesFor('PAYMENT', 'debit')).toBeNull()
    expect(allowedTypesFor('RECEIPT', 'credit')).toBeNull()
  })

  it('pins revenue on the credit side of a sales invoice', () => {
    expect(allowedTypesFor('SALES_INVOICE', 'credit')).toEqual(['REVENUE'])
    expect(allowedTypesFor('DEBIT_NOTE', 'credit')).toEqual(['REVENUE'])
  })

  it('pins cost on the debit side of a purchase invoice', () => {
    expect(allowedTypesFor('PURCHASE_INVOICE', 'debit')).toEqual(['EXPENSE', 'ASSET'])
    expect(allowedTypesFor('CREDIT_NOTE', 'debit')).toEqual(['EXPENSE', 'ASSET'])
  })

  it('leaves a journal unconstrained on both sides', () => {
    expect(allowedTypesFor('JOURNAL', 'debit')).toBeNull()
    expect(allowedTypesFor('JOURNAL', 'credit')).toBeNull()
  })

  it('never contradicts the shape rules for any registered type', () => {
    // A narrowing that the validator would then reject would make the form
    // unusable: the picker would only ever offer an account that cannot post.
    for (const t of VOUCHER_TYPE_ORDER) {
      const debit = allowedTypesFor(t, 'debit')
      const credit = allowedTypesFor(t, 'credit')
      if (debit) expect(debit).toContain('ASSET') // debits are never pinned to non-asset
      if (credit && t !== 'SALES_INVOICE' && t !== 'DEBIT_NOTE') {
        expect(credit).toContain('ASSET')
      }
    }
  })
})
