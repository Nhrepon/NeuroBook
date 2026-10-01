import Link from 'next/link'
import type { AttentionItem, AttentionSeverity } from '@/shared/types'
import { Badge, type BadgeTone } from './Badge'

const TONE: Record<AttentionSeverity, BadgeTone> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
}

/** The word is the signal; the colour reinforces it. */
const WORD: Record<AttentionSeverity, string> = {
  info: 'Note',
  warning: 'Attention',
  danger: 'Blocked',
}

/**
 * Exceptions.
 *
 * An empty list says so explicitly rather than collapsing to nothing — "nothing
 * needs attention" is information, and a missing panel is indistinguishable
 * from a panel that failed to render.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <section aria-label="Needs attention" className="rounded-lg border bg-background p-4">
      <h2 className="text-sm font-medium text-muted-foreground">Needs attention</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing needs attention for this company.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.key} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[item.severity]}>{WORD[item.severity]}</Badge>
                <span className="font-medium">{item.title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              {item.href && (
                <Link href={item.href} className="mt-1 inline-block text-xs underline">
                  Review
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
