import type { Metadata } from 'next'
import Link from 'next/link'
import { listParties } from '@/db/repo/parties'
import { requireScope } from '@/db/scope'

export const metadata: Metadata = { title: 'Parties' }

export default async function PartiesPage() {
  const scope = await requireScope()
  const rows = await listParties(scope)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Parties</h1>
        <Link
          href="/parties/new"
          className="rounded bg-[hsl(var(--primary))] px-3 py-1.5 text-sm text-[hsl(var(--primary-foreground))]"
        >
          New party
        </Link>
      </header>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--accent))] text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">e-BIN</th>
              <th className="px-3 py-2">e-TIN</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.type}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.bin ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.tin ?? '—'}</td>
                <td className="px-3 py-2">{p.active ? 'active' : 'inactive'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No parties yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
