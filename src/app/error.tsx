'use client'

// U4: explicit error UI. Actionable, retry.
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        {error.message || 'Unexpected error.'}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded border px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))]"
      >
        Try again
      </button>
    </div>
  )
}
