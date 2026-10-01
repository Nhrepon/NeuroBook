import { SkeletonCard } from '@/ui/Skeleton'

export default function TrendLoading() {
  return (
    <div role="status" aria-label="Loading revenue and expense trend">
      <SkeletonCard rows={5} />
    </div>
  )
}
