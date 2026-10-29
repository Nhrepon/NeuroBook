'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Plus, Search, type LucideIcon } from 'lucide-react'
import { can, voucherTypePermission, type Role, type VoucherType } from '@neurobook/shared'
import { voucherStatusBadge, voucherTypeLabel } from '@/lib/voucher-ui'
import { FormAlert } from '@/ui/Field'

interface VoucherRow {
  id: string
  date: string
  narration: string
  voucherType: VoucherType
  status: 'draft' | 'posted' | 'reversed'
  sequenceNumber: string | null
  createdAt: string
}

interface VoucherTypeLedgerProps {
  types: VoucherType[]
  primaryType: VoucherType
  title: string
  description: string
  icon: LucideIcon
  /** Overrides the default "/vouchers/new?type=" target for the primary CTA. */
  newHref?: string
  /** Overrides the default "New <type>" CTA label. */
  newLabel?: string
}

/**
 * Day-book view for one voucher family (sales, purchases, money in/out, stock).
 * New entries always go through the shared entry form with the type pre-selected,
 * so no screen can create the empty, unpostable drafts the old pages produced.
 */
export default function VoucherTypeLedger({ types, primaryType, title, description, icon: Icon, newHref: newHrefProp, newLabel: newLabelProp }: VoucherTypeLedgerProps) {
  const [rows, setRows] = useState<VoucherRow[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch('/api/v1/vouchers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load vouchers'))))
      .then((j) => setRows(j.data ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load vouchers'))
      .finally(() => setLoading(false))

    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canRaise = role ? can(role, voucherTypePermission(primaryType)) : true

  const scoped = useMemo(() => rows.filter((r) => types.includes(r.voucherType)), [rows, types])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return scoped
      .filter((r) => !q || r.narration?.toLowerCase().includes(q) || r.sequenceNumber?.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt))
  }, [scoped, query])

  const drafts = scoped.filter((r) => r.status === 'draft').length
  const posted = scoped.filter((r) => r.status === 'posted').length

  const newHref = newHrefProp ?? `/dashboard/vouchers/new?type=${primaryType}`
  const newLabel = newLabelProp ?? `New ${voucherTypeLabel(primaryType).toLowerCase()}`

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Icon size={22} className="text-blue-600" aria-hidden />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>

        <Link
          href={newHref}
          aria-disabled={!canRaise}
          onClick={(e) => {
            if (!canRaise) e.preventDefault()
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold capitalize shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            canRaise
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          <Plus size={15} aria-hidden />
          {newLabel}
        </Link>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Entries</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{scoped.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Drafts</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{drafts}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Posted</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{posted}</p>
        </div>
      </div>

      {role && !canRaise && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can read these entries but not raise new ones.
        </p>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
        <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
        <input
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
          placeholder="Search narration or voucher number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${title}`}
        />
      </div>

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                {types.length > 1 && <th className="px-4 py-2.5 font-medium">Type</th>}
                <th className="px-4 py-2.5 font-medium">Narration</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={types.length > 1 ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading entries…
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={types.length > 1 ? 5 : 4} className="px-4 py-10 text-center text-gray-500">
                    {scoped.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        No {title.toLowerCase()} entries yet.
                        {canRaise && (
                          <Link href={newHref} className="font-semibold capitalize text-blue-600 hover:underline">
                            {newLabel}
                          </Link>
                        )}
                      </span>
                    ) : (
                      'No entries match this search.'
                    )}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link
                        href={`/dashboard/vouchers/${row.id}`}
                        className="font-mono text-xs font-medium text-blue-600 hover:underline"
                      >
                        {row.sequenceNumber ?? 'draft'}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                      {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    {types.length > 1 && (
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{voucherTypeLabel(row.voucherType)}</td>
                    )}
                    <td className="max-w-[320px] truncate px-4 py-2.5 text-gray-900" title={row.narration}>
                      {row.narration || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${voucherStatusBadge(row.status)}`}
                      >
                        {row.status}
                      </span>
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