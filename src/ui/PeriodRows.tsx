'use client'

import { useActionState } from 'react'
import { closePeriodAction, reopenPeriodAction } from '@/actions/settings.actions'
import { Button } from './Button'

interface PeriodRow {
  id: string
  label: string
  status: string
}

export function PeriodRows({ periods, isSuperAdmin }: { periods: PeriodRow[]; isSuperAdmin: boolean }) {
  const [, closeAction, closePending] = useActionState(closePeriodAction, { ok: false, error: undefined })
  const [, reopenAction, reopenPending] = useActionState(reopenPeriodAction, { ok: false, error: undefined })

  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
          <th className="py-2">Period</th>
          <th className="py-2">Status</th>
          <th className="py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {periods.map((p) => (
          <tr key={p.id} className="border-b">
            <td className="py-2">{p.label}</td>
            <td className="py-2">{p.status}</td>
            <td className="py-2 text-right">
              {p.status === 'open' ? (
                <form action={closeAction} className="inline-block">
                  <input type="hidden" name="label" value={p.label} />
                  <Button type="submit" variant="outline" disabled={closePending}>Close</Button>
                </form>
              ) : isSuperAdmin ? (
                <form action={reopenAction} className="inline-block">
                  <input type="hidden" name="label" value={p.label} />
                  <Button type="submit" variant="outline" disabled={reopenPending}>Reopen</Button>
                </form>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
