import type { ReactNode } from 'react'

/**
 * Dashboard grid.
 *
 * The slots are declared here, under `dashboard/`, rather than in
 * `(authenticated)/layout.tsx`. A parallel-route slot resolves against the
 * segment that owns it — `(authenticated)/@analytics/page.tsx` belongs to the
 * group's own URL (`/`), so on `/dashboard` it found no matching slot and fell
 * back to its `default.tsx`, which returns null. The chart and the voucher list
 * were therefore never rendered, while every other page in the group rendered
 * the dashboard's slots into its own layout.
 *
 * Only two slots earn the boundary: the strip, and the activity list. A slot
 * per section would add re-rendering and boundary bookkeeping for regions that
 * are already comfortably fast, and each slot at this level is rendered on
 * every navigation into the segment.
 */
export default function DashboardLayout({
  children,
  kpis,
  trend,
  panels,
  activity,
}: {
  children: ReactNode
  kpis: ReactNode
  trend: ReactNode
  panels: ReactNode
  activity: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-12">{kpis}</div>
      <div className="xl:col-span-8">{trend}</div>
      <div className="space-y-6 xl:col-span-4">{children}</div>
      <div className="space-y-6 xl:col-span-8">{panels}</div>
      <div className="space-y-6 xl:col-span-4">{activity}</div>
    </div>
  )
}
