import Link from 'next/link'
import type {
  AccountBalance,
  AgeingSummary,
  BalanceSheetSummary,
  CashAccountRow,
  LedgerHealth,
  VatSummary,
} from '@/shared/types'
import { formatDateBd } from '@/shared/format'
import { Badge, type BadgeTone } from './Badge'
import { Money } from './Money'

/** Shared chrome for a dashboard panel. */
export function Panel({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs underline hover:text-foreground">
            {action.label}
          </Link>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** One label / value row, the shape every figure row in these panels uses. */
function Row({
  label,
  minor,
  strong,
  tone,
}: {
  label: string
  minor: number | null
  strong?: boolean
  tone?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={tone ? `tabular-nums font-medium ${tone}` : 'tabular-nums'}>
        <Money minor={minor} />
      </span>
    </div>
  )
}

/**
 * The self-check: Σdebit must equal Σcredit across the whole book.
 *
 * A wrong figure is far more alarming than a missing one, so an imbalance is
 * stated in the currency rather than as a generic warning.
 */
export function LedgerHealthPanel({ health }: { health: LedgerHealth }) {
  const tone: BadgeTone = health.balanced ? 'success' : 'danger'
  return (
    <section
      aria-label="Ledger health"
      className={`rounded-lg border p-4 ${
        health.balanced ? 'bg-background' : 'border-danger/50 bg-background'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Ledger health</h2>
        <Badge tone={tone}>{health.balanced ? 'Balanced' : 'Out of balance'}</Badge>
      </div>
      <div className="mt-2 divide-y">
        <Row label="Σ debits" minor={health.totalDebitMinor} />
        <Row label="Σ credits" minor={health.totalCreditMinor} />
        <Row
          label="Difference"
          minor={health.diffMinor}
          strong
          tone={health.balanced ? undefined : 'text-danger'}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {health.accountsWithPostings} account
        {health.accountsWithPostings === 1 ? '' : 's'} carry postings.
      </p>
    </section>
  )
}

export function BalanceSheetPanel({
  bs,
  periodLabel,
}: {
  bs: BalanceSheetSummary
  periodLabel: string
}) {
  const balanced = bs.outOfBalanceMinor === 0
  return (
    <Panel
      title="Balance sheet"
      hint={`As of ${formatDateBd(bs.asOf)} — cumulative, not the ${periodLabel} window.`}
      action={{ href: '/reports/balance-sheet', label: 'Full report' }}
    >
      <div className="divide-y">
        <Row label="Assets" minor={bs.assetsMinor} strong />
        <Row label="Liabilities" minor={bs.liabilitiesMinor} />
        <Row label="Equity" minor={bs.equityMinor} />
        <Row label="Current earnings" minor={bs.retainedEarningsMinor} />
        <Row label="Liabilities + equity" minor={bs.totalsLiabilitiesAndEquityMinor} strong />
      </div>
      {!balanced && (
        <p className="mt-2 rounded border border-danger/40 bg-danger/5 px-2 py-1 text-xs text-danger">
          Assets and claims differ by <Money minor={bs.outOfBalanceMinor} compact />. The book
          does not tie out — check the health panel before relying on any figure here.
        </p>
      )}
    </Panel>
  )
}

/**
 * VAT position for the current return month.
 *
 * Output VAT and input credit are read off the VAT payable account rather than
 * recomputed from invoices: the ledger is the authoritative record, and an
 * invoice-derived figure would disagree with the books whenever a document is
 * amended after posting.
 */
export function VatPanel({ vat }: { vat: VatSummary }) {
  if (!vat.mapped) {
    return (
      <Panel
        title="VAT"
        hint="Bangladesh VAT is reported monthly on the Mushak 6.8 return."
        action={{ href: '/settings', label: 'Map accounts' }}
      >
        <p className="text-sm text-muted-foreground">
          No VAT account is mapped in this chart of accounts, so output VAT and input credit
          cannot be reported. The figure is unknown, not zero.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      title="VAT"
      hint={`Account ${vat.vatAccountCode} · Mushak 6.8 due ${
        vat.nextReturnDue ? formatDateBd(vat.nextReturnDue) : '—'
      }`}
      action={{ href: '/reports', label: 'VAT report' }}
    >
      <div className="divide-y">
        <Row label="Output VAT charged" minor={vat.outputVatMinor} />
        <Row label="Input credit claimed" minor={vat.inputVatMinor} />
        <Row
          label="Net payable to NBR"
          minor={vat.netPayableMinor}
          strong
          tone={vat.netPayableMinor !== null && vat.netPayableMinor > 0 ? 'text-warning' : undefined}
        />
      </div>
      {vat.netPayableMinor !== null && vat.netPayableMinor < 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Negative: input credit exceeds output, so the excess carries forward.
        </p>
      )}
      {vat.sdMinor === null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Supplementary duty is not modelled yet, so it is excluded rather than shown as zero.
        </p>
      )}
    </Panel>
  )
}

/** Cash and bank, per account, with the net movement inside the window. */
export function CashPanel({
  accounts,
  periodLabel,
  totalMinor,
}: {
  accounts: CashAccountRow[]
  periodLabel: string
  totalMinor: number | null
}) {
  if (accounts.length === 0) {
    return (
      <Panel title="Cash & bank" hint={`Movement in ${periodLabel}.`}>
        <p className="text-sm text-muted-foreground">
          No cash or bank account is mapped, so the position is unknown rather than zero.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      title="Cash & bank"
      hint={`Net movement in ${periodLabel}, not gross in and out.`}
      action={{ href: '/accounts', label: 'Chart of accounts' }}
    >
      <table className="w-full text-sm">
        <caption className="sr-only">Cash and bank balances by account</caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="py-1">Account</th>
            <th scope="col" className="py-1 text-right">Balance</th>
            <th scope="col" className="py-1 text-right">Movement</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t">
              <th scope="row" className="py-1.5 text-left font-normal">
                <span className="font-mono text-xs text-muted-foreground">{a.code}</span>{' '}
                {a.name}
              </th>
              <td className="py-1.5 text-right tabular-nums">
                <Money minor={a.balanceMinor} />
              </td>
              <td
                className={`py-1.5 text-right tabular-nums ${
                  a.movementMinor < 0 ? 'text-danger' : a.movementMinor > 0 ? 'text-success' : ''
                }`}
              >
                <Money minor={a.movementMinor} />
              </td>
            </tr>
          ))}
          <tr className="border-t font-medium">
            <th scope="row" className="py-1.5 text-left">Total</th>
            <td className="py-1.5 text-right tabular-nums">
              <Money minor={totalMinor} />
            </td>
            <td className="py-1.5 text-right tabular-nums">
              <Money minor={accounts.reduce((s, a) => s + a.movementMinor, 0)} />
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  )
}

/**
 * Outstanding, aged.
 *
 * Labelled approximate on purpose: ageing is per control *account* and the whole
 * balance takes the age of its oldest uncovered movement, so a partly settled
 * account looks older than it is. A per-party, per-document ageing needs
 * `parties.account_id` and an allocation table (migration 0004).
 */
export function AgeingPanel({ ageing }: { ageing: AgeingSummary }) {
  if (ageing.rows.length === 0) {
    return (
      <Panel title="Outstanding" hint="Receivables and payables by age.">
        <p className="text-sm text-muted-foreground">
          Nothing is outstanding on the mapped control accounts.
        </p>
      </Panel>
    )
  }

  const max = Math.max(...ageing.byBucket.map((b) => Math.abs(b.minor)), 1)

  return (
    <Panel
      title="Outstanding"
      hint="Aged per control account, not per party — approximate."
      action={{ href: '/reports/ageing', label: 'Full report' }}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ageing.byBucket.map((b) => (
          <div key={b.key} className="rounded border p-2">
            <p className="text-xs text-muted-foreground">{b.label}</p>
            <p className="tabular-nums text-sm font-medium">
              <Money minor={b.minor} compact />
            </p>
            {/* A proportional bar, so the shape of the ageing is readable
                without reading four numbers. Decorative: the value is above. */}
            <div aria-hidden="true" className="mt-1 h-1 rounded bg-muted">
              <div
                className="h-1 rounded bg-chart-1"
                style={{ width: `${Math.min(100, (Math.abs(b.minor) / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Outstanding balances by account and age</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1">Ledger</th>
              <th scope="col" className="py-1 text-right">Outstanding</th>
              <th scope="col" className="py-1 text-right">Oldest item</th>
            </tr>
          </thead>
          <tbody>
            {ageing.rows.map((r) => (
              <tr key={r.accountId} className="border-t">
                <th scope="row" className="py-1.5 text-left font-normal">
                  <span className="font-mono text-xs text-muted-foreground">{r.code}</span>{' '}
                  {r.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.direction === 'credit' ? 'Payable' : 'Receivable'}
                  </span>
                </th>
                <td className="py-1.5 text-right tabular-nums">
                  <Money minor={r.outstandingMinor} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-xs text-muted-foreground">
                  {r.ageDays === null ? '—' : `${r.ageDays}d`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** The largest balances in the book, for a quick "where is the money" read. */
export function TopAccountsPanel({ accounts }: { accounts: AccountBalance[] }) {
  return (
    <Panel
      title="Largest balances"
      hint="Across every account in the chart, by absolute value."
      action={{ href: '/accounts', label: 'All accounts' }}
    >
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No account carries a balance yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-muted-foreground">{a.code}</span>{' '}
                {a.name}
                <span className="ml-2 text-xs text-muted-foreground">{a.type}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <Money minor={a.balanceMinor} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

