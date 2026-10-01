import { Suspense } from 'react'
import { Panel } from '@/ui/InsightPanels'
import { TrendChart } from '@/ui/TrendChart'
import { SkeletonCard } from '@/ui/Skeleton'
import { loadDashboard, periodParams } from '../data'
import { currentFiscalYear } from '@/shared/format'

type SearchParams = Record<string, string | string[] | undefined>

/** Revenue / expenses / net profit over time. */
export default function TrendSlot({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<SkeletonCard rows={5} />}>
      <Trend searchParams={searchParams} />
    </Suspense>
  )
}

async function Trend({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { period, from, to } = periodParams(await searchParams)
  const { kpis } = await loadDashboard(period, from, to)
  const fy = currentFiscalYear()

  return (
    <Panel title="Revenue & expenses" hint="From posted vouchers, in the ledger's own account types.">
      <TrendChart
        points={kpis.series}
        fyLabel={kpis.period.label}
        fyStartBucket={`${fy.start.getUTCFullYear()}-${String(fy.start.getUTCMonth() + 1).padStart(2, '0')}`}
      />
    </Panel>
  )
}
