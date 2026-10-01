'use client'

/**
 * Dashboard error boundary.
 *
 * An error here means an aggregate query failed. The honest response is to show
 * no figures rather than last-rendered ones: a stale balance in an accounting
 * app is worse than a blank panel, because nothing on screen would say it was
 * stale.
 */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-background p-6">
      <h2 className="text-lg font-semibold">The dashboard could not be loaded</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || 'Unexpected error.'}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        No figures are shown rather than possibly stale ones.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded border px-3 py-1.5 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Try again
      </button>
    </div>
  )
}
