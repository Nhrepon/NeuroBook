import Link from 'next/link'
import { formatDelta } from '@/shared/format'
import type { KpiCard } from '@/shared/types'
import { Money } from './Money'
import { Sparkline } from './Sparkline'

/**
 * Colour per delta direction. Never the only signal — the arrow glyph and the
 * signed percentage carry the same meaning, so the card still reads correctly
 * without colour perception.
 */
const DELTA_TONE: Record<'up' | 'down' | 'flat', string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-muted-foreground',
}

const DELTA_GLYPH: Record<'up' | 'down' | 'flat', string> = {
  up: '▲',
  down: '▼',
  flat: '■',
}

function direction(deltaPct: number | null): 'up' | 'down' | 'flat' {
  if (deltaPct === null || deltaPct === 0) return 'flat'
  return deltaPct > 0 ? 'up' : 'down'
}

/**
 * One KPI.
 *
 * Three states, not two. A mapped-with-zero figure renders ৳ 0.00; a figure the
 * chart of accounts cannot produce renders "Not mapped", which is a different
 * statement. Replacing the second with the first is how a dashboard lies.
 */
export function StatCard({ card, previousLabel }: { card: KpiCard; previousLabel: string }) {
  const notMapped = card.minor === null
  const dir = direction(card.deltaPct)
  const delta = formatDelta(card.deltaPct)

  return (
    <div className="relative flex flex-col rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{card.label}</p>

      {notMapped ? (
        <p className="mt-2 text-base font-medium text-muted-foreground">Not mapped</p>
      ) : (
        <p className="mt-2 text-2xl font-semibold">
          <Money minor={card.minor} compact />
        </p>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={`text-xs font-medium ${DELTA_TONE[dir]}`}>
          <span aria-hidden="true">{DELTA_GLYPH[dir]} </span>
          {delta}
          <span className="ml-1 font-normal text-muted-foreground">
            vs <span aria-hidden="true">{previousLabel}</span>
            <span className="sr-only">{previousLabel}</span>
          </span>
        </p>
        {!notMapped && card.series.length > 1 && (
          <Sparkline values={card.series} className={`${DELTA_TONE[dir]} shrink-0`} />
        )}
      </div>

      {card.href && (
        // Overlay link: the card stays plain text for assistive tech, while the
        // whole tile is one keyboard-reachable target with a short, specific
        // accessible name.
        <Link
          href={card.href}
          className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="sr-only">View {card.label}</span>
        </Link>
      )}
    </div>
  )
}
