'use client'

import { Suspense, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { PeriodKey } from '@/shared/types'

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'mtd', label: 'This month' },
  { key: 'qtd', label: 'This quarter' },
  { key: 'fy', label: 'This fiscal year' },
  { key: '30d', label: 'Last 30 days' },
]

function Picker({ value }: { value: PeriodKey }) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="period" className="text-sm text-muted-foreground">
        Period
      </label>
      <select
        id="period"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = new URLSearchParams(params)
          next.set('period', e.target.value)
          // A preset replaces any custom bounds; leaving them behind would let a
          // stale `from`/`to` silently win over the newly chosen period.
          next.delete('from')
          next.delete('to')
          start(() => router.push(`?${next.toString()}`))
        }}
        className="rounded border bg-background px-2 py-1 text-sm"
      >
        {PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
        {/* Present only when the URL carries one, so the select never shows a
            value the user cannot see in the list. */}
        {value === 'custom' && <option value="custom">Custom range</option>}
      </select>
      {pending && (
        <span role="status" className="text-xs text-muted-foreground">
          Updating…
        </span>
      )}
    </div>
  )
}

/**
 * Period selector. Writes `?period=` so the window is part of the URL: every
 * dashboard view is therefore linkable, shareable, and correct under the back
 * button, and the figures never depend on client state.
 */
export function PeriodPicker({ value }: { value: PeriodKey }) {
  return (
    <Suspense fallback={<div className="h-8 w-40" aria-hidden="true" />}>
      <Picker value={value} />
    </Suspense>
  )
}
