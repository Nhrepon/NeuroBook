'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, ScrollText, Search, ShieldCheck } from 'lucide-react'
import { FormAlert } from '@/ui/Field'

interface AuditRow {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  ip: string | null
  createdAt: string
}

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  update: 'bg-blue-50 text-blue-700 ring-blue-200',
  post: 'bg-violet-50 text-violet-700 ring-violet-200',
  reverse: 'bg-red-50 text-red-700 ring-red-200',
  delete: 'bg-red-50 text-red-700 ring-red-200',
}

function badgeFor(action: string): string {
  const verb = action.split('.').pop() ?? action
  return ACTION_BADGE[verb] ?? 'bg-gray-100 text-gray-600 ring-gray-300'
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/v1/audit')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load the audit log'))))
      .then((j) => setRows(j.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the audit log'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter(
        (r) =>
          !q ||
          r.action.toLowerCase().includes(q) ||
          r.resourceType.toLowerCase().includes(q) ||
          r.resourceId?.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [rows, query])

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <ScrollText size={22} className="text-blue-600" aria-hidden />
          Audit log
        </h1>
        <p className="mt-1 text-sm text-gray-500">Every write against this company, newest first. Records are append-only.</p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
            placeholder="Search action or resource"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search audit log"
          />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
          <ShieldCheck size={13} className="text-gray-400" aria-hidden />
          {visible.length} of {rows.length} events
        </span>
      </div>

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Resource</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading audit log...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? 'No audit events recorded yet.' : 'No events match this search.'}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                      {new Date(row.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeFor(row.action)}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {row.resourceType}
                      {row.resourceId && <span className="ml-1 font-mono text-xs text-gray-400">{row.resourceId.slice(0, 8)}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-500">
                      {row.ip || <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
