import { SkeletonStatStrip } from '@/ui/Skeleton'

export default function KpisLoading() {
  return (
    <div role="status" aria-label="Loading key figures">
      <SkeletonStatStrip />
    </div>
  )
}
