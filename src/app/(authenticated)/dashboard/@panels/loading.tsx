import { SkeletonCard } from '@/ui/Skeleton'

export default function PanelsLoading() {
  return (
    <div role="status" aria-label="Loading panels">
      <SkeletonCard rows={6} />
    </div>
  )
}
