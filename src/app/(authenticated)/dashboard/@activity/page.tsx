import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { listVouchers } from '@/db/repo/vouchers'
import { listInvoices } from '@/db/repo/invoices'
import { requireScope } from '@/db/scope'
import { RecentActivity, type ActivityTab } from '@/ui/RecentActivity'
import { RecentInvoices } from '@/ui/RecentInvoices'
import { RecentVouchers } from '@/ui/RecentVouchers'
import { SkeletonCard } from '@/ui/Skeleton'
import { periodParams } from '../data'

const ACTIVITY_LIMIT = 8

type SearchParams = Record<string, string | string[] | undefined>

/** Activity slot: one list at a time, selected by `?activity=`. */
export default function ActivitySlot({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<SkeletonCard rows={6} />}>
      <ActivityList searchParams={searchParams} />
    </Suspense>
  )
}

async function ActivityList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const tab: ActivityTab = sp.activity === 'invoices' ? 'invoices' : 'vouchers'
  const scope = await requireScope()

  // Tab links carry the period through: switching view must not silently reset
  // the window the rest of the dashboard is reporting on.
  const { period } = periodParams(sp)
  const href = (extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (period) params.set('period', period)
    for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v)
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  let body: ReactNode
  if (tab === 'invoices') {
    body = <RecentInvoices items={await listInvoices(scope, ACTIVITY_LIMIT)} />
  } else {
    const { items } = await listVouchers(scope, { limit: ACTIVITY_LIMIT })
    body = <RecentVouchers items={items} />
  }

  return (
    <RecentActivity
      tab={tab}
      vouchersHref={href()}
      invoicesHref={href({ activity: 'invoices' })}
      viewAllHref={tab === 'invoices' ? '/invoices' : '/vouchers'}
    >
      {body}
    </RecentActivity>
  )
}
