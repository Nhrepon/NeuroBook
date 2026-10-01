import type { DashboardKpis } from '@/shared/types'
import { formatDateBd } from '@/shared/format'
import { EmptyState } from './EmptyState'
import { Money } from './Money'
import { PeriodPicker } from './PeriodPicker'
import { StatCard } from './StatCard'

/**
 * The clock is pinned to UTC on purpose. Every window boundary in this system is
 * UTC-anchored, so a "12:40" rendered in the server's local zone would describe
 * a different instant from the one the figures were computed at.
 */
const utcTime = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

/** Inclusive end of the window, for display. `to` is exclusive in queries. */
function displayEnd(toIso: string): string {
  return formatDateBd(new Date(new Date(toIso).getTime() - 1))
}

/**
 * The KPI strip and the context that makes its figures readable.
 *
 * Every number here is scoped by the period shown beside it: an accountant must
 * be able to say what window a figure covers without leaving the page.
 */
export function KpiStrip({ kpis }: { kpis: DashboardKpis }) {
  const hasAnyVoucher = kpis.postedVoucherCount > 0 || kpis.draftVoucherCount > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{kpis.period.label}</span>
            {' · '}
            {formatDateBd(kpis.period.from)} – {displayEnd(kpis.period.to)}
            {' · '}
            {kpis.postedVoucherCount} posted voucher
            {kpis.postedVoucherCount === 1 ? '' : 's'}
            {kpis.draftVoucherCount > 0 &&
              ` · ${kpis.draftVoucherCount} draft${kpis.draftVoucherCount === 1 ? '' : 's'}`}
            {' · '}
            as of {formatDateBd(kpis.asOf)} {utcTime.format(new Date(kpis.asOf))} UTC
          </p>
        </div>
        <PeriodPicker value={kpis.period.key} />
      </div>

      {hasAnyVoucher ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.cards.map((card) => (
            <StatCard key={card.key} card={card} previousLabel={kpis.previous.label} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No vouchers yet"
          description="Nothing has been posted to this company, so there are no figures to report. Create a voucher to start the ledger."
          actionHref="/vouchers/new"
          actionLabel="Create a voucher"
        />
      )}

      {hasAnyVoucher && (
        <p className="text-xs text-muted-foreground">
          Σ posted debit in this period: <Money minor={kpis.postedDebitMinor} />
          {' · '}
          deltas compare against {kpis.previous.label}
        </p>
      )}
    </div>
  )
}
