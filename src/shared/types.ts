// Domain types — shared between web and mobile.
// Money is integer minor units (taka × 100). Never float. See R7.

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'

export type VoucherStatus = 'draft' | 'posted' | 'reversed'

export type VoucherType =
  | 'PAYMENT'
  | 'RECEIPT'
  | 'JOURNAL'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'CONTRA'
  | 'REFUND'
  | 'TRANSFER'
  | 'STOCK_TRANSFER'
  | 'ADJUSTMENT'

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'MANAGER'
  | 'STAFF'
  | 'SALES'
  | 'AUDITOR'
  | 'USER'
  | 'GUEST'
  | 'VIEWER'

export type TdsSection =
  | '52' | '52A' | '52AA' | '52B' | '52BB' | '53AA' | '56'

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

export interface JournalEntry {
  accountId: string
  accountType: AccountType
  debit: number          // minor units, non-negative
  credit: number         // minor units, non-negative
  reference?: string
}

export interface Voucher {
  id: string
  date: string           // ISO date
  narration: string
  entries: JournalEntry[]
  totalDebit: number
  totalCredit: number
  status: VoucherStatus
  version: number        // optimistic concurrency (R5)
  idempotencyKey?: string
  sequenceNumber?: string
  reversedById?: string
  voucherType: VoucherType
  tenantId: string
}

export interface Account {
  id: string
  name: string
  code: string
  type: AccountType
  parentId?: string
  isGroup: boolean
  openingBalance: number
  taxApplicable: boolean
  taxCategory?: string
  taxRate?: number
  taxExempt?: boolean
  taxDeductible?: boolean
  taxDeductibleRate?: number
  taxExemptRate?: number
  taxExemptReason?: string
  taxDeductibleReason?: string
  tenantId: string
}

// ---------------------------------------------------------------------------
// Dashboard payloads. Shared with the Expo client (§3.3) so the mobile
// dashboard and the web dashboard are fed by one contract and cannot disagree.
// Every amount is integer minor units (taka × 100) — see R7.
// ---------------------------------------------------------------------------

/** Window selector for every period-aware surface. Mirrors PeriodKeySchema. */
export type PeriodKey = 'mtd' | 'qtd' | 'fy' | '30d' | 'custom'

export type KpiKey =
  | 'receivable'
  | 'payable'
  | 'cashBank'
  | 'revenue'
  | 'expenses'
  | 'netProfit'

export interface KpiCard {
  key: KpiKey
  label: string
  /** `null` means the chart of accounts has no mapping for this figure — it
   *  is unknown, not zero. The UI must say so rather than print ৳ 0.00. */
  minor: number | null
  /** Same figure for the immediately preceding window, for the delta. */
  prevMinor: number | null
  /** Percent change, or `null` when there is no baseline (previous === 0). */
  deltaPct: number | null
  /** Drill-through target, e.g. /reports/ageing. */
  href: string | null
  /** Sparkline points in minor units, oldest first. Empty when unavailable. */
  series: number[]
}

export interface DashboardSeriesPoint {
  /** 'YYYY-MM', UTC-bucketed. */
  bucket: string
  revenueMinor: number
  expensesMinor: number
  netProfitMinor: number
}

export interface DashboardKpis {
  period: { key: PeriodKey; label: string; from: string; to: string }
  previous: { label: string; from: string; to: string }
  cards: KpiCard[]
  /** Posted vouchers inside the window. */
  postedVoucherCount: number
  /** Unposted drafts, all time — a backlog, not a period figure. */
  draftVoucherCount: number
  /** Σ posted debit inside the window (the old "posted total"). */
  postedDebitMinor: number
  /** KPI keys whose accounts are absent from the chart of accounts. */
  unmapped: KpiKey[]
  series: DashboardSeriesPoint[]
  /** ISO instant the balance-type figures were computed as of. */
  asOf: string
  /**
   * Roll-ups of the same per-account query the cards use, so they cost no extra
   * round trip: the balance sheet, the ledger health check, the per-account cash
   * breakdown, the VAT panel, and the largest balances.
   */
  balanceSheet: BalanceSheetSummary
  health: LedgerHealth
  vat: VatSummary
  cashAccounts: CashAccountRow[]
  topAccounts: AccountBalance[]
  /** Cumulative net profit carried into equity — needs a lifetime P&L. */
  retainedEarningsMinor: number
}

export type AttentionSeverity = 'info' | 'warning' | 'danger'

/**
 * Per-account as-of position, as of an instant: opening balance plus the net
 * movement of every posted voucher before that instant. One query yields the
 * KPI balances, the balance sheet, the ledger health check, the cash breakdown,
 * and the top-accounts list — they are all roll-ups of this.
 */
export interface AccountBalance {
  id: string
  code: string
  name: string
  type: string
  openingMinor: number
  /** Debits posted before the as-of instant. */
  debitMinor: number
  /** Credits posted before the as-of instant. */
  creditMinor: number
  /** The same window one period earlier, for the delta on a card. */
  prevDebitMinor: number
  prevCreditMinor: number
  /** Opening + the movement, in the account's own normal direction. */
  balanceMinor: number
}

export interface LedgerHealth {
  totalDebitMinor: number
  totalCreditMinor: number
  /** Σdebit − Σcredit. Must be 0 for the book to be balanced. */
  diffMinor: number
  balanced: boolean
  accountsWithPostings: number
}

export interface BalanceSheetSummary {
  assetsMinor: number
  liabilitiesMinor: number
  equityMinor: number
  /** Net profit since inception, carried into equity as current earnings. */
  retainedEarningsMinor: number
  totalsLiabilitiesAndEquityMinor: number
  /** assets − (liabilities + equity). Non-zero means the book does not balance. */
  outOfBalanceMinor: number
  asOf: string
}

export interface VatSummary {
  /** `null` when no VAT account is mapped — unknown, not zero. */
  outputVatMinor: number | null
  inputVatMinor: number | null
  /** Output − input credit. Positive means owed to NBR. */
  netPayableMinor: number | null
  sdMinor: number | null
  vatAccountCode: string | null
  mapped: boolean
  /** Mushak 6.8 is due on the 15th of the month after the return month. */
  nextReturnDue: string | null
}

export interface AgeingBucket {
  key: string
  label: string
  minor: number
}

export interface AgeingRow {
  accountId: string
  code: string
  name: string
  /** Receivable is debit-normal, payable is credit-normal. */
  direction: 'debit' | 'credit'
  outstandingMinor: number
  /** Date of the oldest movement that is still uncovered. */
  oldestOpenDate: string | null
  ageDays: number | null
  buckets: AgeingBucket[]
}

export interface AgeingSummary {
  rows: AgeingRow[]
  byBucket: AgeingBucket[]
  totalReceivableMinor: number
  totalPayableMinor: number
  /**
   * Phase A approximation: aged per control *account*, with the whole
   * outstanding attributed to the age of its oldest uncovered movement. It is
   * not a per-party open-item ageing — that needs `parties.account_id` and an
   * allocation table (migration 0004). The UI labels this as approximate.
   */
  approximate: true
}

export interface CashAccountRow {
  id: string
  code: string
  name: string
  balanceMinor: number
  /**
   * Net movement inside the selected period (as-of balance minus the balance one
   * period earlier). Deliberately not a gross inflow/outflow split: that would
   * need per-account windowed debits and credits, and reporting a net figure
   * under a "gross" label would be the kind of small lie this dashboard is
   * trying to avoid.
   */
  movementMinor: number
}

export interface TopCustomerRow {
  id: string
  name: string
  invoiceCount: number
  grossMinor: number
}

export interface InvoiceStats {
  count: number
  grossMinor: number
  subtotalMinor: number
  vatMinor: number
  sdMinor: number
  /** 0 when there are no invoices — never a division by zero. */
  averageMinor: number
  topCustomers: TopCustomerRow[]
  /** 'YYYY-MM' buckets, gross invoice value. */
  series: Array<{ bucket: string; grossMinor: number }>
  /** Invoices whose payload has no readable totals, so the sum understates. */
  unpricedCount: number
}

export interface FiscalProgress {
  label: string
  startDate: string
  endDate: string
  dayOfPeriod: number
  daysInPeriod: number
  daysRemaining: number
  /** 0–100, rounded to one decimal. */
  percentElapsed: number
  status: 'open' | 'closed' | 'unknown'
}

/** Everything the dashboard shows beyond the six KPI cards. */
export interface DashboardDetail {
  health: LedgerHealth
  balanceSheet: BalanceSheetSummary
  vat: VatSummary
  ageing: AgeingSummary
  topAccounts: AccountBalance[]
  cashAccounts: CashAccountRow[]
  invoices: InvoiceStats
  fiscal: FiscalProgress
  drafts: { count: number; oldestDate: string | null }
}


/** Exceptions worth surfacing on the dashboard. Phase 1 covers only what is
 *  derivable without an accounts.system_role mapping. */
export interface AttentionItem {
  key: 'drafts' | 'periodClosed' | 'unmapped'
  severity: AttentionSeverity
  title: string
  detail: string
  href?: string
}

export interface ApiError {
  code:
    | 'PERIOD_LOCKED'
    | 'UNBALANCED'
    | 'CONFLICT'
    | 'IMMUTABLE'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'RATE_LIMITED'
    | 'VALIDATION'
    | 'SERVICE_UNAVAILABLE'
    | 'INTERNAL'
  message: string
  field?: string
  retryable?: boolean
}

export interface ApiResponse<T> {
  data?: T
  meta?: { cursor?: string; totalCount?: number }
  error?: ApiError
}
