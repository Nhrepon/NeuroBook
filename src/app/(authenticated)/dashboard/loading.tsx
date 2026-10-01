import { SkeletonCard, SkeletonStatStrip } from '@/ui/Skeleton'

/**
 * Segment-level loading UI. Mirrors the dashboard grid so nothing shifts when
 * the real content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonStatStrip />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SkeletonCard rows={5} />
        </div>
        <div className="xl:col-span-4">
          <SkeletonCard rows={5} />
        </div>
      </div>
    </div>
  )
}
