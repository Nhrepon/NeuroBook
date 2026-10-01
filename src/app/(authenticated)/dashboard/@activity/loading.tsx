import { SkeletonCard } from '@/ui/Skeleton'

export default function ActivityLoading() {
  return (
    <div role="status" aria-label="Loading recent activity">
      <SkeletonCard rows={6} />
    </div>
  )
}
