import { Suspense } from 'react'
import { KpiStrip } from '@/ui/KpiStrip'
import { SkeletonStatStrip } from '@/ui/Skeleton'
import { loadDashboard, periodParams } from '../data'

type SearchParams = Record<string, string | string[] | undefined>

/**
 * KPI slot.
 *
 * A Suspense boundary inside the page (in addition to the segment's
 * `loading.tsx`) so that changing `?period=` streams the new figures in while
 * the rest of the dashboard stays interactive.
 */
export default function KpiSlot({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<SkeletonStatStrip />}>
      <Strip searchParams={searchParams} />
    </Suspense>
  )
}

async function Strip({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { period, from, to } = periodParams(await searchParams)
  const { kpis } = await loadDashboard(period, from, to)

  return (
    <section aria-label="Key figures">
      <KpiStrip kpis={kpis} />
    </section>
  )
}
