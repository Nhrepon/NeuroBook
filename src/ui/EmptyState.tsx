import Link from 'next/link'

/**
 * Empty state.
 *
 * Used instead of a grid of zeroes: a tenant that has posted nothing is not
 * "a business with ৳ 0.00 of revenue", it has no data yet, and the useful thing
 * to show is the next action.
 */
export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="rounded-lg border border-dashed bg-background p-8 text-center">
      <p className="text-base font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
