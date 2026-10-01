// Dashboard aggregates.
//
// R7/U6: every figure is computed by Postgres and comes back as a scalar. The
// code this replaces fetched up to 500 vouchers and reduced them in JS, which
// silently truncated every total once a tenant passed the row cap — and
// `listVouchers` clamps its limit to 200, so even the 500 was a lie.
//
// Driver note: postgres-js surfaces int8/numeric results as JS `string`s
// (verified against this database: `count(*)` → '2', `sum(x)::bigint` → '3').
// Every aggregate therefore passes through toSafeInt() before it is used as a
// number, so a driver change fails loudly instead of yielding "12" + 3 === "123".
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { fiscalPeriods } from '../schema/tenant'
import type { RequestScope } from '../scope'
import { endOfUtcDay, resolvePeriod, trailingMonths } from '@/shared/periods'
import type {
  AccountBalance,
  AgeingRow,
  AgeingSummary,
  AttentionItem,
  BalanceSheetSummary,
  CashAccountRow,
  DashboardKpis,
  DashboardSeriesPoint,
  KpiCard,
  KpiKey,
  LedgerHealth,
  VatSummary,
} from '@/shared/types'
import { currentFiscalYear, percentChange } from '@/shared/format'

// ---------------------------------------------------------------------------
// Driver boundary
// ---------------------------------------------------------------------------

/**
 * Coerce an aggregate to a safe integer, or throw.
 *
 * Every money value in this system is an integer count of poisha, so counts and
 * sums share one guard. `Number('')` would be 0 and `Number('1e999')` would be
 * Infinity — both are silent corruption in a ledger, so they are rejected.
 */
function toSafeInt(value: unknown, field: string): number {
  const s = typeof value === 'number' ? String(value) : String(value ?? '')
  if (!/^-?\d+$/.test(s)) {
    throw new Error(`Dashboard aggregate "${field}" is not an integer: ${JSON.stringify(value)}`)
  }
  const n = Number(s)
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Dashboard aggregate "${field}" exceeds the safe integer range: ${s}`)
  }
  return n
}

// ---------------------------------------------------------------------------
// Chart-of-accounts mapping
// ---------------------------------------------------------------------------

/**
 * Phase 1 stand-in for `accounts.system_role` (migration 0004, Phase 2).
 *
 * These are the codes of the seeded BD chart of accounts (src/db/seed.ts):
 * 1100 Cash in Hand, 1200 Cash at Bank, 1300 Sundry Debtors, 2100 Sundry
 * Creditors. A tenant whose chart does not use them gets `null` for that
 * figure — reported as "not mapped" — rather than a confident ৳ 0.00, which is
 * the difference between a missing number and a wrong one.
 */
const ROLE_CODES = {
  cashBank: ['1100', '1200'],
  receivable: ['1300'],
  payable: ['2100'],
} as const

type BalanceRole = keyof typeof ROLE_CODES

/**
 * Ageing covers only the debtor and creditor control accounts. Cash and bank are
 * deliberately excluded: a cash balance has no age, and folding it in would make
 * an "outstanding" total that is mostly petty cash.
 */
const AGEING_CODES: string[] = [...ROLE_CODES.receivable, ...ROLE_CODES.payable]

/** `a.code in ('1300','2100')` as a parameterised list, never concatenated. */
const ageingCodeList = sql.join(
  AGEING_CODES.map((code) => sql`${code}`),
  sql`, `,
)

export const DASHBOARD_ROLE_CODES = ROLE_CODES

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// Row shapes returned by the aggregate queries.
//
// Each extends `Record<string, unknown>` because that is what drizzle's
// `execute<TRow>` generic requires; the declared fields stay precisely typed
// underneath it.

interface TypeBucketRow extends Record<string, unknown> {
  account_type: string
  cur_debit: string
  cur_credit: string
  prev_debit: string
  prev_credit: string
}

interface TypeBucket {
  type: string
  curD: number
  curC: number
  prevD: number
  prevC: number
}

/**
 * Revenue / expenses / net profit for the window and for the window before it,
 * in one pass over one index range (FILTER keeps it to a single scan).
 *
 * Grouped by `journal_lines.account_type` — the type recorded on the line at
 * write time — so the figure is the ledger's own classification. This is why
 * revenue is *not* `vouchers.total_debit`: an invoice books Dr receivable /
 * Cr revenue, so its debit total is the receivable, not the income.
 */
async function fetchTypeBuckets(
  scope: RequestScope,
  period: { from: Date; to: Date; previous: { from: Date; to: Date } },
): Promise<TypeBucket[]> {
  const curFrom = period.from.toISOString()
  const curTo = period.to.toISOString()
  const prevFrom = period.previous.from.toISOString()
  const prevTo = period.previous.to.toISOString()

  const rows = await db.execute<TypeBucketRow>(sql`
    select jl.account_type,
           coalesce(sum(jl.debit) filter (
             where v.date >= ${curFrom}::timestamptz and v.date < ${curTo}::timestamptz
           ), 0)::bigint as cur_debit,
           coalesce(sum(jl.credit) filter (
             where v.date >= ${curFrom}::timestamptz and v.date < ${curTo}::timestamptz
           ), 0)::bigint as cur_credit,
           coalesce(sum(jl.debit) filter (
             where v.date >= ${prevFrom}::timestamptz and v.date < ${prevTo}::timestamptz
           ), 0)::bigint as prev_debit,
           coalesce(sum(jl.credit) filter (
             where v.date >= ${prevFrom}::timestamptz and v.date < ${prevTo}::timestamptz
           ), 0)::bigint as prev_credit
      from journal_lines jl
      join vouchers v
        on v.id = jl.voucher_id and v.tenant_id = jl.tenant_id
     where jl.tenant_id = ${scope.tenantId}
       and v.status = 'posted'
    group by jl.account_type
  `)

  return [...rows].map((r) => ({
    type: r.account_type,
    curD: toSafeInt(r.cur_debit, `${r.account_type}.debit`),
    curC: toSafeInt(r.cur_credit, `${r.account_type}.credit`),
    prevD: toSafeInt(r.prev_debit, `prev.${r.account_type}.debit`),
    prevC: toSafeInt(r.prev_credit, `prev.${r.account_type}.credit`),
  }))
}

interface SeriesRow extends Record<string, unknown> {
  bucket: string
  account_type: string
  debit: string
  credit: string
}

/**
 * Monthly revenue / expense series for the KPI sparklines.
 *
 * Buckets are truncated in UTC explicitly (`at time zone 'UTC'`) rather than
 * relying on the session TimeZone, so a month boundary does not move with the
 * database's configuration.
 */
async function fetchSeries(
  scope: RequestScope,
  from: Date,
  to: Date,
): Promise<DashboardSeriesPoint[]> {
  const rows = await db.execute<SeriesRow>(sql`
    select to_char(date_trunc('month', v.date at time zone 'UTC'), 'YYYY-MM') as bucket,
           jl.account_type,
           coalesce(sum(jl.debit), 0)::bigint  as debit,
           coalesce(sum(jl.credit), 0)::bigint as credit
      from journal_lines jl
      join vouchers v
        on v.id = jl.voucher_id and v.tenant_id = jl.tenant_id
     where jl.tenant_id = ${scope.tenantId}
       and v.status = 'posted'
       and v.date >= ${from.toISOString()}::timestamptz
       and v.date <  ${to.toISOString()}::timestamptz
    group by 1, 2
    order by 1
  `)

  const byBucket = new Map<string, DashboardSeriesPoint>()
  for (const r of rows) {
    const point =
      byBucket.get(r.bucket) ??
      { bucket: r.bucket, revenueMinor: 0, expensesMinor: 0, netProfitMinor: 0 }
    const debit = toSafeInt(r.debit, `series.${r.bucket}.debit`)
    const credit = toSafeInt(r.credit, `series.${r.bucket}.credit`)
    if (r.account_type === 'REVENUE') point.revenueMinor += credit - debit
    if (r.account_type === 'EXPENSE') point.expensesMinor += debit - credit
    byBucket.set(r.bucket, point)
  }

  return [...byBucket.values()]
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
    .map((p) => ({ ...p, netProfitMinor: p.revenueMinor - p.expensesMinor }))
}

interface AccountRow extends Record<string, unknown> {
  id: string
  code: string
  name: string
  type: string
  opening: string
  cur_debit: string
  cur_credit: string
  prev_debit: string
  prev_credit: string
}

/**
 * The per-account as-of position for the whole chart, with the same figure one
 * period earlier.
 *
 * This single query is the spine of most of the dashboard. Rolled up, it gives
 * the KPI balances (mapped codes), the balance sheet (by type), the ledger
 * health check (Σdebit vs Σcredit), the cash breakdown, the top-accounts list and
 * the VAT panel — so none of those need a query of its own.
 *
 * The posted lines are gathered in a derived table and LEFT JOINed, because the
 * two jobs differ: a mapped account with no postings must still surface its
 * opening balance, while an account carrying only draft vouchers must contribute
 * nothing. Putting the `status = 'posted'` test in the join condition instead
 * would let draft lines into the sum.
 */
async function fetchAccountBalances(
  scope: RequestScope,
  asOf: Date,
  previousAsOf: Date,
): Promise<AccountBalance[]> {
  const asOfIso = asOf.toISOString()
  const prevIso = previousAsOf.toISOString()

  const rows = await db.execute<AccountRow>(sql`
    select a.id,
           a.code,
           a.name,
           a.type,
           coalesce(max(a.opening_balance), 0)::bigint as opening,
           coalesce(sum(p.debit)  filter (where p.date < ${asOfIso}::timestamptz), 0)::bigint as cur_debit,
           coalesce(sum(p.credit) filter (where p.date < ${asOfIso}::timestamptz), 0)::bigint as cur_credit,
           coalesce(sum(p.debit)  filter (where p.date < ${prevIso}::timestamptz), 0)::bigint as prev_debit,
           coalesce(sum(p.credit) filter (where p.date < ${prevIso}::timestamptz), 0)::bigint as prev_credit
      from accounts a
      left join (
        select jl.account_id, jl.tenant_id, jl.debit, jl.credit, v.date
          from journal_lines jl
          join vouchers v
            on v.id = jl.voucher_id and v.tenant_id = jl.tenant_id
         where jl.tenant_id = ${scope.tenantId}
           and v.status = 'posted'
           and v.date < ${asOfIso}::timestamptz
      ) p
        on p.account_id = a.id and p.tenant_id = a.tenant_id
     where a.tenant_id = ${scope.tenantId}
       and a.active = true
     group by a.id, a.code, a.name, a.type
     order by a.code
  `)

  return [...rows].map((r) => {
    const opening = toSafeInt(r.opening, `${r.code}.opening`)
    const debit = toSafeInt(r.cur_debit, `${r.code}.debit`)
    const credit = toSafeInt(r.cur_credit, `${r.code}.credit`)
    const prevDebit = toSafeInt(r.prev_debit, `${r.code}.prev_debit`)
    const prevCredit = toSafeInt(r.prev_credit, `${r.code}.prev_credit`)
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      openingMinor: opening,
      debitMinor: debit,
      creditMinor: credit,
      prevDebitMinor: prevDebit,
      prevCreditMinor: prevCredit,
      // Debit-normal for assets and expenses, credit-normal for the rest, which
      // is the direction `opening_balance` is stored in.
      balanceMinor:
        r.type === 'LIABILITY' || r.type === 'EQUITY' || r.type === 'REVENUE'
          ? opening + credit - debit
          : opening + debit - credit,
    }
  })
}

interface CountRow extends Record<string, unknown> {
  posted_count: string
  draft_count: string
  posted_debit: string
}

/**
 * Posted/draft voucher counts and Σ posted debit for the window.
 *
 * Drafts are counted all-time on purpose: an unposted backlog is a state, not a
 * period figure, and hiding it because it falls outside the selected window is
 * how drafts get forgotten. `count(*)` is a bigint, so it arrives as a string.
 */
async function fetchCounts(scope: RequestScope, from: Date, to: Date) {
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const rows = await db.execute<CountRow>(sql`
    select count(*) filter (
             where status = 'posted'
               and date >= ${fromIso}::timestamptz and date < ${toIso}::timestamptz
           )::bigint as posted_count,
           count(*) filter (where status = 'draft')::bigint as draft_count,
           coalesce(sum(total_debit) filter (
             where status = 'posted'
               and date >= ${fromIso}::timestamptz and date < ${toIso}::timestamptz
           ), 0)::bigint as posted_debit
      from vouchers
     where tenant_id = ${scope.tenantId}
  `)

  const row = [...rows][0]
  return {
    // A bare aggregate with no GROUP BY always yields exactly one row; the
    // fallback keeps the impossible case from throwing inside a render.
    postedCount: toSafeInt(row?.posted_count ?? '0', 'posted_count'),
    draftCount: toSafeInt(row?.draft_count ?? '0', 'draft_count'),
    postedDebit: toSafeInt(row?.posted_debit ?? '0', 'posted_debit'),
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Roll the mapped codes up into one balance per role.
 *
 * Returns `null` when the tenant's chart of accounts contains none of the codes
 * for that role — "unknown", which the UI renders as *not mapped*. Otherwise the
 * as-of balance, plus the same balance one period earlier for the delta.
 */
function roleBalanceFor(
  balances: AccountBalance[],
  role: BalanceRole,
): { cur: number; prev: number } | null {
  const codes: readonly string[] = ROLE_CODES[role]
  const matched = balances.filter((b) => codes.includes(b.code))
  if (matched.length === 0) return null

  let cur = 0
  let prev = 0
  for (const b of matched) {
    cur += b.balanceMinor
    // Recompute the same balance as it stood one period earlier.
    prev +=
      role === 'payable'
        ? b.openingMinor + b.prevCreditMinor - b.prevDebitMinor
        : b.openingMinor + b.prevDebitMinor - b.prevCreditMinor
  }
  return { cur, prev }
}

export interface DashboardQuery {
  period?: string
  from?: string
  to?: string
}

// ---------------------------------------------------------------------------
// Roll-ups of the per-account query
//
// Everything below is arithmetic on `balances` — no extra round trips. The
// dashboard earns its speed from that: one per-account query answers the cards,
// the balance sheet, the health check, the cash breakdown and the VAT panel.
// ---------------------------------------------------------------------------

/** Codes that hold a VAT payable balance, Phase 1 stand-in for system_role. */
const VAT_CODES = ['2200'] as const

function sumBy(balances: AccountBalance[], type: string): number {
  let total = 0
  for (const b of balances) if (b.type === type) total += b.balanceMinor
  return total
}

/** The balance an account showed one period earlier, in its normal direction. */
function previousBalance(b: AccountBalance): number {
  return b.type === 'LIABILITY' || b.type === 'EQUITY' || b.type === 'REVENUE'
    ? b.openingMinor + b.prevCreditMinor - b.prevDebitMinor
    : b.openingMinor + b.prevDebitMinor - b.prevCreditMinor
}

function buildHealth(balances: AccountBalance[]): LedgerHealth {
  let debit = 0
  let credit = 0
  let accountsWithPostings = 0
  for (const b of balances) {
    debit += b.debitMinor
    credit += b.creditMinor
    if (b.debitMinor > 0 || b.creditMinor > 0) accountsWithPostings += 1
  }
  return {
    totalDebitMinor: debit,
    totalCreditMinor: credit,
    diffMinor: debit - credit,
    balanced: debit === credit,
    accountsWithPostings,
  }
}

function buildBalanceSheet(balances: AccountBalance[], asOf: Date): BalanceSheetSummary {
  const assets = sumBy(balances, 'ASSET')
  const liabilities = sumBy(balances, 'LIABILITY')
  const equity = sumBy(balances, 'EQUITY')
  // Revenue and expense balances are the P&L since inception, carried into
  // equity as current earnings — the same treatment the shared balanceSheet()
  // builder uses, and the reason assets tie to liabilities + equity.
  const retainedEarnings = sumBy(balances, 'REVENUE') - sumBy(balances, 'EXPENSE')
  const totalsLiabilitiesAndEquity = liabilities + equity + retainedEarnings
  return {
    assetsMinor: assets,
    liabilitiesMinor: liabilities,
    equityMinor: equity,
    retainedEarningsMinor: retainedEarnings,
    totalsLiabilitiesAndEquityMinor: totalsLiabilitiesAndEquity,
    outOfBalanceMinor: assets - totalsLiabilitiesAndEquity,
    asOf: asOf.toISOString(),
  }
}

function buildVat(balances: AccountBalance[], now: Date): VatSummary {
  const match = balances.find((b) => (VAT_CODES as readonly string[]).includes(b.code))
  if (!match) {
    return {
      outputVatMinor: null,
      inputVatMinor: null,
      netPayableMinor: null,
      sdMinor: null,
      vatAccountCode: null,
      mapped: false,
      nextReturnDue: null,
    }
  }
  // On a liability, credits are output VAT charged and debits are input credit
  // claimed, so the balance is exactly what is owed to NBR.
  const outputVatMinor = match.creditMinor
  const inputVatMinor = match.debitMinor
  // Mushak 6.8 for a month is filed by the 15th of the month after it.
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15))
  return {
    outputVatMinor,
    inputVatMinor,
    netPayableMinor: match.balanceMinor,
    sdMinor: null,
    vatAccountCode: match.code,
    mapped: true,
    nextReturnDue: due.toISOString(),
  }
}

function buildCashAccounts(balances: AccountBalance[]): CashAccountRow[] {
  const codes: readonly string[] = ROLE_CODES.cashBank
  return balances
    .filter((b) => codes.includes(b.code))
    .map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      balanceMinor: b.balanceMinor,
      movementMinor: b.balanceMinor - previousBalance(b),
    }))
}

function buildTopAccounts(balances: AccountBalance[], limit = 5): AccountBalance[] {
  return balances
    .filter((b) => b.balanceMinor !== 0)
    .sort((a, b) => Math.abs(b.balanceMinor) - Math.abs(a.balanceMinor))
    .slice(0, limit)
}


/**
 * Every figure on the KPI strip, from four aggregate queries.
 *
 * `now` is injected so window boundaries are deterministic in tests; it is also
 * what keeps the "as of" honest, by clamping a window that reaches into the
 * future back to the end of today.
 */
export async function getDashboardKpis(
  scope: RequestScope,
  query: DashboardQuery = {},
  now: Date = new Date(),
): Promise<DashboardKpis> {
  const period = resolvePeriod(query, now)

  // The FY window ends on 30 June next year, but the balances it reports are
  // today's. Clamping stops a balance card claiming to be as of a date that has
  // not happened; a window already in the past is taken as given, because that
  // is the period the user asked to see.
  const todayEnd = endOfUtcDay(now)
  const asOf = period.to.getTime() > todayEnd.getTime() ? todayEnd : period.to
  const span = period.to.getTime() - period.from.getTime()
  const previousAsOf = new Date(asOf.getTime() - span)

  const [buckets, balances, counts, series] = await Promise.all([
    fetchTypeBuckets(scope, period),
    fetchAccountBalances(scope, asOf, previousAsOf),
    fetchCounts(scope, period.from, period.to),
    fetchSeries(scope, trailingMonths(asOf, 12), asOf),
  ])

  const byType = new Map(buckets.map((b) => [b.type, b]))
  const revenue = byType.get('REVENUE')
  const expense = byType.get('EXPENSE')
  const curRevenue = revenue ? revenue.curC - revenue.curD : 0
  const prevRevenue = revenue ? revenue.prevC - revenue.prevD : 0
  const curExpenses = expense ? expense.curD - expense.curC : 0
  const prevExpenses = expense ? expense.prevD - expense.prevC : 0
  const curNet = curRevenue - curExpenses
  const prevNet = prevRevenue - prevExpenses

  const unmapped: KpiKey[] = []

  const balanceCard = (key: BalanceRole, label: string, href: string): KpiCard => {
    const b = roleBalanceFor(balances, key)
    if (!b) {
      unmapped.push(key)
      return { key, label, minor: null, prevMinor: null, deltaPct: null, href: null, series: [] }
    }
    return {
      key,
      label,
      minor: b.cur,
      prevMinor: b.prev,
      deltaPct: percentChange(b.cur, b.prev),
      href,
      series: [],
    }
  }

  const flowCard = (
    key: KpiKey,
    label: string,
    cur: number,
    prev: number,
    points: number[],
    href: string,
  ): KpiCard => ({
    key,
    label,
    minor: cur,
    prevMinor: prev,
    deltaPct: percentChange(cur, prev),
    href,
    series: points,
  })

  const cards: KpiCard[] = [
    balanceCard('receivable', 'Receivable', '/reports/ageing'),
    balanceCard('payable', 'Payable', '/reports/ageing'),
    balanceCard('cashBank', 'Cash & Bank', '/accounts'),
    flowCard(
      'revenue',
      'Revenue',
      curRevenue,
      prevRevenue,
      series.map((p) => p.revenueMinor),
      '/reports/profit-loss',
    ),
    flowCard(
      'expenses',
      'Expenses',
      curExpenses,
      prevExpenses,
      series.map((p) => p.expensesMinor),
      '/reports/profit-loss',
    ),
    flowCard(
      'netProfit',
      'Net Profit',
      curNet,
      prevNet,
      series.map((p) => p.netProfitMinor),
      '/reports/profit-loss',
    ),
  ]

  const balanceSheet = buildBalanceSheet(balances, asOf)

  return {
    period: {
      key: period.key,
      label: period.label,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    previous: {
      label: period.previous.label,
      from: period.previous.from.toISOString(),
      to: period.previous.to.toISOString(),
    },
    cards,
    postedVoucherCount: counts.postedCount,
    draftVoucherCount: counts.draftCount,
    postedDebitMinor: counts.postedDebit,
    unmapped,
    series,
    asOf: asOf.toISOString(),
    balanceSheet,
    health: buildHealth(balances),
    vat: buildVat(balances, now),
    cashAccounts: buildCashAccounts(balances),
    topAccounts: buildTopAccounts(balances),
    retainedEarningsMinor: balanceSheet.retainedEarningsMinor,
  }
}

/**
 * Exceptions worth a user's attention.
 *
 * Deliberately narrow: reports only what the current schema can prove. Overdue
 * receivables and VAT-return deadlines need `accounts.system_role` and an
 * open-item ledger (Phase 2) — guessing at them here would put invented money
 * on the dashboard, which is worse than omitting them.
 */
export async function getDashboardAttention(
  scope: RequestScope,
  kpis: DashboardKpis,
  now: Date = new Date(),
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = []

  if (kpis.draftVoucherCount > 0) {
    const n = kpis.draftVoucherCount
    items.push({
      key: 'drafts',
      severity: 'warning',
      title: `${n} unposted draft${n === 1 ? '' : 's'}`,
      detail: 'Drafts are excluded from every total and report until they are posted.',
      href: '/vouchers?status=draft',
    })
  }

  if (kpis.unmapped.length > 0) {
    items.push({
      key: 'unmapped',
      severity: 'info',
      title: `No chart-of-accounts mapping for: ${kpis.unmapped.join(', ')}`,
      detail:
        'Those figures read "not mapped" rather than showing a balance. Map the control accounts in Settings so the dashboard can report them.',
      href: '/settings',
    })
  }

  const fy = currentFiscalYear(now)
  const [period] = await db
    .select()
    .from(fiscalPeriods)
    .where(and(eq(fiscalPeriods.tenantId, scope.tenantId), eq(fiscalPeriods.label, fy.label)))

  if (period?.status === 'closed') {
    items.push({
      key: 'periodClosed',
      severity: 'danger',
      title: `${fy.label} is closed`,
      detail:
        'Posting is refused for this period. Only a SUPER_ADMIN can reopen it, and the reopen is audit-logged.',
      href: '/settings',
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Dashboard detail
// ---------------------------------------------------------------------------

interface AgeingSqlRow extends Record<string, unknown> {
  account_id: string
  code: string
  name: string
  type: string
  opening: string
  outstanding: string
  oldest_open: string | null
}

/**
 * Outstanding on the mapped control accounts, aged by its oldest uncovered
 * movement.
 *
 * Driven from `accounts` rather than from the journal so that a control account
 * carrying only an opening balance still appears — otherwise a fully-settled
 * ledger would report nothing at all, which is indistinguishable from an aged
 * one.
 *
 * The running balance is accumulated in each account's *own* normal direction
 * (credit-normal for liabilities), so a single `bal > 0` test finds where the
 * obligation first appeared regardless of which side it sits on. `date` and
 * `line_id` order the window, which matters when several lines share a day.
 */
async function fetchAgeing(
  scope: RequestScope,
  asOf: Date,
): Promise<Array<Omit<AgeingRow, 'buckets' | 'ageDays'>>> {
  const rows = await db.execute<AgeingSqlRow>(sql`
    with scoped as (
      select a.id, a.code, a.name, a.type, a.opening_balance
        from accounts a
       where a.tenant_id = ${scope.tenantId}
         and a.active = true
         and a.code in (${ageingCodeList})
    ), lines as (
      select s.id as account_id, jl.id as line_id, jl.debit, jl.credit, v.date
        from journal_lines jl
        join vouchers v
          on v.id = jl.voucher_id and v.tenant_id = jl.tenant_id
        join scoped s on s.id = jl.account_id
       where jl.tenant_id = ${scope.tenantId}
         and v.status = 'posted'
         and v.date < ${asOf.toISOString()}::timestamptz
    ), running as (
      select s.id, s.code, s.name, s.type, s.opening_balance, l.date, l.line_id,
             case when s.type = 'LIABILITY'
                  then coalesce(l.credit, 0) - coalesce(l.debit, 0)
                  else coalesce(l.debit, 0) - coalesce(l.credit, 0)
             end as signed
        from scoped s
        left join lines l on l.account_id = s.id
    ), accumulated as (
      select id, code, name, type, opening_balance, date, signed,
             case when type = 'LIABILITY'
                  then opening_balance
                       - coalesce(sum(signed) over w, 0)
                  else opening_balance
                       + coalesce(sum(signed) over w, 0)
             end as bal
        from running
      window w as (
        partition by id order by date, line_id
        rows between unbounded preceding and current row
      )
    )
    select id as account_id, code, name, type,
           coalesce(max(opening_balance), 0)::bigint as opening,
           -- The outstanding is the *final* position, not the peak. Taking
           -- max(bal) would keep reporting a debtor at their highest-ever
           -- balance long after a partial payment had reduced it.
           (coalesce(max(opening_balance), 0) + coalesce(sum(signed), 0))::bigint as outstanding,
           min(case when bal > 0 then date end) as oldest_open
      from accumulated
     group by id, code, name, type
     order by code
  `)

  return [...rows].map((r) => ({
    accountId: r.account_id,
    code: r.code,
    name: r.name,
    direction: r.type === 'LIABILITY' ? ('credit' as const) : ('debit' as const),
    outstandingMinor: toSafeInt(r.outstanding, `ageing.${r.code}.outstanding`),
    oldestOpenDate: r.oldest_open,
  }))
}

const AGE_BUCKETS = [
  { key: '0-30', label: 'Not due', max: 30 },
  { key: '31-60', label: '1–30 days late', max: 60 },
  { key: '61-90', label: '31–60 days late', max: 90 },
  { key: '90+', label: '90+ days late', max: Number.POSITIVE_INFINITY },
] as const

const MS_PER_DAY = 86_400_000

/**
 * Ageing on the mapped control accounts, bucketed.
 *
 * The whole outstanding of an account is attributed to the age of its oldest
 * uncovered movement, which overstates the old buckets when a balance is partly
 * settled. That is why `AgeingSummary.approximate` is set and why the panel
 * says so: a real open-item ageing needs a per-document allocation table.
 */
export async function getDashboardAgeing(
  scope: RequestScope,
  now: Date = new Date(),
): Promise<AgeingSummary> {
  const asOf = endOfUtcDay(now)
  const raw = await fetchAgeing(scope, asOf)

  const emptyBuckets = (): AgeingSummary['byBucket'] =>
    AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, minor: 0 }))

  const rows: AgeingRow[] = []
  const byBucket = emptyBuckets()
  let totalReceivableMinor = 0
  let totalPayableMinor = 0

  for (const r of raw) {
    // A settled account is not an aged one; showing ৳ 0 rows would bury the
    // accounts that actually need attention.
    if (r.outstandingMinor === 0) continue

    const ageDays = r.oldestOpenDate
      ? Math.max(
          0,
          Math.floor((asOf.getTime() - new Date(r.oldestOpenDate).getTime()) / MS_PER_DAY),
        )
      : null
    const index =
      ageDays === null
        ? 0
        : AGE_BUCKETS.findIndex((b) => ageDays <= b.max)

    const buckets: AgeingSummary['byBucket'] = emptyBuckets()
    const target = index === -1 ? 0 : index
    buckets[target] = { ...buckets[target]!, minor: r.outstandingMinor }
    byBucket[target] = { ...byBucket[target]!, minor: byBucket[target]!.minor + r.outstandingMinor }

    if (r.direction === 'credit') totalPayableMinor += r.outstandingMinor
    else totalReceivableMinor += r.outstandingMinor

    rows.push({ ...r, ageDays, buckets })
  }

  rows.sort((a, b) => b.outstandingMinor - a.outstandingMinor)

  return { rows, byBucket, totalReceivableMinor, totalPayableMinor, approximate: true }
}



