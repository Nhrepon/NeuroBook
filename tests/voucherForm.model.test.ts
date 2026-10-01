// The model behind the new-voucher form (U1, §5.3).
//
// These exist because the web app has no React testing library: the rules that
// decide whether a voucher may be saved are worth testing, so they live outside
// the component rather than inside it.
import { describe, it, expect } from 'vitest'
import {
  blankRow,
  parseMinor,
  formatMinorInput,
  toEntries,
  totals,
  staleSelections,
  clientProblems,
  type Row,
  type AccountOpt,
} from '@/ui/voucherForm.model'

const CHART: AccountOpt[] = [
  { id: 'cash', code: '1000', name: 'Cash in hand', type: 'ASSET' },
  { id: 'bank', code: '1010', name: 'Bank', type: 'ASSET' },
  { id: 'creditors', code: '2000', name: 'Sundry creditors', type: 'LIABILITY' },
  { id: 'debtors', code: '1100', name: 'Sundry debtors', type: 'ASSET' },
  { id: 'sales', code: '4000', name: 'Sales', type: 'REVENUE' },
  { id: 'rent', code: '5010', name: 'Rent', type: 'EXPENSE' },
]

function row(partial: Partial<Row> & { key: number }): Row {
  return { ...blankRow(partial.key), ...partial }
}

describe('parseMinor — tolerant of how people type', () => {
  it('parses plain and decimal amounts', () => {
    expect(parseMinor('12')).toBe(1200)
    expect(parseMinor('12.5')).toBe(1250)
    expect(parseMinor('12.50')).toBe(1250)
    expect(parseMinor('0.01')).toBe(1)
    expect(parseMinor('1234.56')).toBe(123456)
  })

  it('accepts the intermediate state of typing a decimal', () => {
    // A controlled input that rejects "12." makes "12.50" untypeable — the
    // reason the amount fields hold text rather than numbers.
    expect(parseMinor('12.')).toBe(1200)
    expect(parseMinor('.')).toBe(0)
  })

  it('strips separators and the currency symbol', () => {
    expect(parseMinor('1,500')).toBe(150000)
    expect(parseMinor('৳ 1,500.50')).toBe(150050)
    expect(parseMinor(' 25 ')).toBe(2500)
  })

  it('returns 0 rather than NaN for anything unusable', () => {
    expect(parseMinor('')).toBe(0)
    expect(parseMinor('abc')).toBe(0)
    expect(parseMinor('-5')).toBe(0)
    expect(parseMinor('12.3.4')).toBe(0)
    expect(parseMinor('1e5')).toBe(0)
  })

  it('rounds a third decimal place to the nearest paisa', () => {
    expect(parseMinor('12.345')).toBe(1235)
  })
})

describe('toEntries', () => {
  it('drops a side with no account and a side with no amount', () => {
    const entries = toEntries(
      [
        row({ key: 1, debitAccountId: 'creditors', debitText: '50' }),
        row({ key: 2, creditAccountId: 'bank', creditText: '' }), // amount missing
        row({ key: 3, debitText: '50' }), // account missing
      ],
      CHART,
    )
    expect(entries).toHaveLength(1)
    expect(entries[0]!.accountId).toBe('creditors')
  })

  it('never emits a 0/0 line', () => {
    const entries = toEntries([row({ key: 1, debitAccountId: 'cash', debitText: '0' })], CHART)
    expect(entries).toEqual([])
  })

  it('takes the account type from the chart, never from a guess', () => {
    // Resolving the type from the row would let REVENUE post as ASSET — it
    // still balances, and it still corrupts the trial balance.
    const entries = toEntries(
      [
        row({ key: 1, debitAccountId: 'debtors', debitText: '100' }),
        row({ key: 2, creditAccountId: 'sales', creditText: '100' }),
      ],
      CHART,
    )
    expect(entries.map((e) => e.accountType)).toEqual(['ASSET', 'REVENUE'])
  })
})

describe('totals', () => {
  it('sums only what will post', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'creditors', debitText: '50' }),
      row({ key: 2, creditAccountId: 'bank', creditText: '30' }),
      // Half-filled — account but no amount: dropped, and reported by
      // clientProblems rather than silently inflating the footer.
      row({ key: 3, debitAccountId: 'cash', debitText: '' }),
    ]
    expect(totals(rows, CHART)).toEqual({ debit: 5000, credit: 3000, difference: 2000 })
  })

  it('reports balance once both sides agree', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'creditors', debitText: '25.75' }),
      row({ key: 2, creditAccountId: 'bank', creditText: '25.75' }),
    ]
    expect(totals(rows, CHART).difference).toBe(0)
  })
})

describe('staleSelections — the type changed underneath the row', () => {
  it('flags an account the new type may not use', () => {
    // Picked while the type was PAYMENT, then switched to CONTRA: the picker
    // no longer lists it (so the select renders blank) but the state holds it.
    const rows = [row({ key: 1, debitAccountId: 'rent', debitText: '50' })]
    const stale = staleSelections(rows, 'CONTRA', CHART)
    expect(stale).toHaveLength(1)
    expect(stale[0]!.account.id).toBe('rent')
    expect(stale[0]!.side).toBe('debit')
  })

  it('stays quiet when the account is allowed', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'bank', debitText: '50' }),
      row({ key: 2, creditAccountId: 'cash', creditText: '50' }),
    ]
    expect(staleSelections(rows, 'CONTRA', CHART)).toEqual([])
  })

  it('ignores empty sides', () => {
    expect(staleSelections([row({ key: 1 })], 'CONTRA', CHART)).toEqual([])
  })
})


describe('formatMinorInput', () => {
  it('shows nothing for zero and two decimals otherwise', () => {
    expect(formatMinorInput(0)).toBe('')
    expect(formatMinorInput(1200)).toBe('12.00')
    expect(formatMinorInput(1250)).toBe('12.50')
    expect(formatMinorInput(1)).toBe('0.01')
  })
})

describe('clientProblems — what blocks a save', () => {
  const base = { accounts: CHART, date: '2025-09-15', narration: 'Rent for September' }

  const balanced = [
    row({ key: 1, debitAccountId: 'rent', debitText: '5000' }),
    row({ key: 2, creditAccountId: 'bank', creditText: '5000' }),
  ]

  it('refuses a document type outright, and says where to go', () => {
    // The bug this prevents: a sales invoice typed here as two bare account
    // lines — no VAT split, no `invoices` row, no Mushak 6.2. Indistinguishable
    // on screen from a correct one.
    const rows = [
      row({ key: 1, debitAccountId: 'debtors', debitText: '5000' }),
      row({ key: 2, creditAccountId: 'sales', creditText: '5000' }),
    ]
    const problems = clientProblems({ ...base, type: 'SALES_INVOICE', rows })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/invoice form, not here/)
  })

  it('refuses every document type, and nothing else', () => {
    const documents = ['SALES_INVOICE', 'PURCHASE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE']
    for (const t of documents) {
      const problems = clientProblems({ ...base, type: t as never, rows: balanced })
      expect(problems.join(' '), t).toMatch(/invoice form/)
    }
    const money = ['PAYMENT', 'RECEIPT', 'REFUND', 'CONTRA', 'TRANSFER', 'JOURNAL', 'ADJUSTMENT', 'STOCK_TRANSFER']
    for (const t of money) {
      expect(clientProblems({ ...base, type: t as never, rows: [] }).join(' '), t).not.toMatch(
        /invoice form/,
      )
    }
  })

  it('is empty for a well-formed voucher', () => {
    expect(clientProblems({ ...base, type: 'PAYMENT', rows: balanced })).toEqual([])
  })

  it('requires a date', () => {
    const problems = clientProblems({ ...base, type: 'PAYMENT', date: '', rows: balanced })
    expect(problems.join(' ')).toMatch(/Pick a date/)
  })

  it('requires a narration', () => {
    const problems = clientProblems({ ...base, type: 'PAYMENT', narration: '   ', rows: balanced })
    expect(problems.join(' ')).toMatch(/Narration is required/)
  })

  it('reports a half-filled row rather than dropping it silently', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'rent', debitText: '5000' }),
      row({ key: 2, creditAccountId: 'bank', creditText: '' }),
      row({ key: 3, creditAccountId: 'cash', creditText: '5000' }),
    ]
    const problems = clientProblems({ ...base, type: 'PAYMENT', rows })
    expect(problems.join(' ')).toMatch(/Line 2 - the credit has an account but no amount/)
  })

  it('reports an amount with no account', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'rent', debitText: '5000' }),
      row({ key: 2, creditText: '5000' }),
    ]
    const problems = clientProblems({ ...base, type: 'PAYMENT', rows })
    expect(problems.join(' ')).toMatch(/Line 2 - the credit has an amount but no account/)
  })

  it('needs two lines before it says anything about the ledger', () => {
    const problems = clientProblems({ ...base, type: 'PAYMENT', rows: [balanced[0]!] })
    expect(problems.join(' ')).toMatch(/at least two lines/)
  })

  it('reports the balance gap in taka', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'rent', debitText: '50' }),
      row({ key: 2, creditAccountId: 'bank', creditText: '30' }),
    ]
    const problems = clientProblems({ ...base, type: 'PAYMENT', rows })
    expect(problems.join(' ')).toMatch(/differ by ৳ 20\.00/)
  })

  it('enforces the §5.3 structural rules before the round trip', () => {
    // The case that used to reach the server and bounce: a CONTRA between an
    // expense account and a control account, balancing perfectly.
    const rows = [
      row({ key: 1, debitAccountId: 'rent', debitText: '5000' }),
      row({ key: 2, creditAccountId: 'creditors', creditText: '5000' }),
    ]
    expect(totals(rows, CHART).difference).toBe(0)
    const problems = clientProblems({ ...base, type: 'CONTRA', rows })
    expect(problems.join(' ')).toMatch(/cash\/bank/i)
  })

  it('explains a row the current type forbids', () => {
    const rows = [
      row({ key: 1, debitAccountId: 'rent', debitText: '5000' }),
      row({ key: 2, creditAccountId: 'bank', creditText: '5000' }),
    ]
    const problems = clientProblems({ ...base, type: 'CONTRA', rows })
    expect(problems.join(' ')).toMatch(/Line 1 - Rent may not be debited on a contra/)
  })
})
