// Per-segment loading UI (Next.js 16). Streams in while the page resolves.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 p-6">
      <div className="h-8 w-1/3 rounded bg-[hsl(var(--muted))]" />
      <div className="h-32 rounded bg-[hsl(var(--muted))]" />
      <div className="h-64 rounded bg-[hsl(var(--muted))]" />
    </div>
  )
}
