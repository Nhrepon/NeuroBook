import type { Metadata } from 'next'
import { AttentionList } from '@/ui/AttentionList'
import { QuickActions } from '@/ui/QuickActions'
import { LedgerHealthPanel, VatPanel } from '@/ui/InsightPanels'
import { loadDashboard, periodParams } from './data'

export const metadata: Metadata = { title: 'Dashboard' }

type SearchParams = Record<string, string | string[] | undefined>

/**
 * The dashboard's own content, i.e. the `children` slot: the status column.
 *
 * The header and the KPI figures live in `@kpis`, the trend in `@trend`, the
 * derived panels in `@panels`, and the activity list in `@activity`. All of them
 * fetch through `loadDashboard`, which is `cache()`d, so the regions share one
 * set of queries rather than each running their own.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { period, from, to } = periodParams(await searchParams)
  const { kpis, attention } = await loadDashboard(period, from, to)

  return (
    <div className="space-y-6">
      <AttentionList items={attention} />
      <LedgerHealthPanel health={kpis.health} />
      <VatPanel vat={kpis.vat} />
      <QuickActions />
    </div>
  )
}

