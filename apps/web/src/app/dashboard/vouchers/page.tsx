'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, FileText, Loader2, Plus, Search } from 'lucide-react'
import { canAny, type Role, type VoucherType } from '@neurobook/shared'
import { voucherStatusBadge, voucherTypeLabel, voucherWritePermissions } from '@/lib/voucher-ui'
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

export default function VouchersPage() {
  const [rows, setRows] = useState<VoucherRow[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | VoucherType>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | VoucherRow['status']>('ALL')

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

  const canRaise = role ? canAny(role, voucherWritePermissions) : true

  const types = useMemo(
    () => Array.from(new Set(rows.map((r) => r.voucherType))).sort(),
    [rows],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => typeFilter === 'ALL' || r.voucherType === typeFilter)
      .filter((r) => statusFilter === 'ALL' || r.status === statusFilter)
      .filter(
        (r) =>
          !q ||
          r.narration?.toLowerCase().includes(q) ||
          r.sequenceNumber?.toLowerCase().includes(q) ||
          r.voucherType.toLowerCase().includes(q),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt))
  }, [rows, query, typeFilter, statusFilter])

  const counts = useMemo(
    () => ({
      draft: rows.filter((r) => r.status === 'draft').length,
      posted: rows.filter((r) => r.status === 'posted').length,
      reversed: rows.filter((r) => r.status === 'reversed').length,
    }),
    [rows],
  )

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <FileText size={22} className="text-blue-600" aria-hidden />
            Vouchers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Every accounting entry for this company. Posted vouchers are immutable and reversed, never edited.
          </p>
        </div>

        <Link
          href="/dashboard/vouchers/new"
          aria-disabled={!canRaise}
          onClick={(e) => {
            if (!canRaise) e.preventDefault()
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            canRaise
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          <Plus size={15} aria-hidden />
          New voucher
        </Link>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Drafts</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">{counts.draft}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Posted</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{counts.posted}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-gray-500">Reversed</p>
          <p className="mt-1 text-xl font-semibold text-gray-500">{counts.reversed}</p>
        </div>
      </div>

      {role && !canRaise && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can read vouchers but not raise them.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
            placeholder="Search narration, number or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search vouchers"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | VoucherType)}
          aria-label="Filter by voucher type"
          className="w-auto rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
        >
          <option value="ALL">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {voucherTypeLabel(t)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | VoucherRow['status'])}
          aria-label="Filter by status"
          className="w-auto rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
        >
          <option value="ALL">All statuses</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="reversed">Reversed</option>
        </select>
      </div>

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Narration</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading vouchers…
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-2">
                        No vouchers yet. Raise one to start your day book.
                        <Link href="/dashboard/vouchers/new" className="font-semibold text-blue-600 hover:underline">
                          New voucher
                        </Link>
                      </span>
                    ) : (
                      'No vouchers match these filters.'
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
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{voucherTypeLabel(row.voucherType)}</td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-gray-900" title={row.narration}>
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

      {visible.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Showing {visible.length} of {rows.length} vouchers
        </p>
      )}
    </main>
  )
}
