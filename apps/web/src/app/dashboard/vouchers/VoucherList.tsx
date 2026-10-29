'use client'

import { voucherStatusBadge, voucherTypeLabel, voucherWritePermissions } from '@/lib/voucher-ui'
import DataTable from '@/ui/DataTable'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import SearchInput from '@/ui/SearchInput'
import { StatCard, StatGrid } from '@/ui/StatCard'
import { canAny, type Role, type VoucherType } from '@neurobook/shared'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface VoucherRow {
  id: string
  date: string
  narration: string
  voucherType: VoucherType
  status: 'draft' | 'posted' | 'reversed'
  sequenceNumber: string | null
  createdAt: string
}

export default function VoucherList() {
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
    <main className="mx-auto max-w-7xl">
      <PageHeader
        icon={FileText}
        title="Vouchers"
        description="Every accounting entry for this company. Posted vouchers are immutable and reversed, never edited."
      >
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
      </PageHeader>

      <StatGrid>
        <StatCard label="Drafts" value={counts.draft} tone="text-amber-600" />
        <StatCard label="Posted" value={counts.posted} tone="text-emerald-600" />
        <StatCard label="Reversed" value={counts.reversed} tone="text-gray-500" />
      </StatGrid>

      {role && !canRaise && <RoleNotice>Your role can read vouchers but not raise them.</RoleNotice>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search narration, number or type" className="max-w-sm flex-1" />

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

      <DataTable
        columns={[
          { key: 'number', label: 'Number' },
          { key: 'date', label: 'Date' },
          { key: 'type', label: 'Type' },
          { key: 'narration', label: 'Narration' },
          { key: 'status', label: 'Status' },
        ]}
        loading={loading}
        loadingLabel="Loading vouchers..."
        isEmpty={visible.length === 0}
        empty={
          rows.length === 0 ? (
            <span className="inline-flex flex-col items-center gap-2">
              No vouchers yet. Raise one to start your day book.
              <Link href="/dashboard/vouchers/new" className="font-semibold text-blue-600 hover:underline">
                New voucher
              </Link>
            </span>
          ) : (
            'No vouchers match these filters.'
          )
        }
      >
        {visible.map((row) => (
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
      </DataTable>

      {visible.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Showing {visible.length} of {rows.length} vouchers
        </p>
      )}
    </main>
  )
}