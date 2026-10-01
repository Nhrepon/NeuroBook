import { Suspense } from 'react'
import {
  AgeingPanel,
  BalanceSheetPanel,
  CashPanel,
  TopAccountsPanel,
} from '@/ui/InsightPanels'
import { SkeletonCard } from '@/ui/Skeleton'
import { loadDashboard, periodParams } from '../data'

type SearchParams = Record<string, string | string[] | undefined>

/** The panels derived from the same per-account query the KPI cards use. */
export default function PanelsSlot({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<SkeletonCard rows={6} />}>
      <Panels searchParams={searchParams} />
    </Suspense>
  )
}

async function Panels({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { period, from, to } = periodParams(await searchParams)
  const { kpis, ageing } = await loadDashboard(period, from, to)
  const cashTotal = kpis.cards.find((c) => c.key === 'cashBank')?.minor ?? null

  return (
    <div className="space-y-6">
      <AgeingPanel ageing={ageing} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BalanceSheetPanel bs={kpis.balanceSheet} periodLabel={kpis.period.label} />
        <CashPanel
          accounts={kpis.cashAccounts}
          periodLabel={kpis.period.label}
          totalMinor={cashTotal}
        />
      </div>
      <TopAccountsPanel accounts={kpis.topAccounts} />
    </div>
  )
}
