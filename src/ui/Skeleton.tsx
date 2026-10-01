// Skeleton placeholders.
//
// `aria-hidden` throughout: a pulse tells a sighted user "loading", while a
// screen reader would otherwise announce a run of meaningless empty divs. The
// async region announces itself instead via `role="status"`.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-muted ${className}`} />
}

/** Placeholder matching <StatCard>, so the strip does not reflow on load. */
export function SkeletonStatCard() {
  return (
    <div aria-hidden="true" className="rounded-lg border bg-background p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-4 w-20" />
    </div>
  )
}

/** Placeholder for the six-card KPI strip. */
export function SkeletonStatStrip({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  )
}

/** Placeholder for a card containing a list or a table. */
export function SkeletonCard({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-lg border bg-background p-4 ${className}`}>
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

