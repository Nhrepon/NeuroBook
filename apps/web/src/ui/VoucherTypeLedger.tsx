'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, type LucideIcon } from 'lucide-react'
import { can, voucherTypePermission, type Role, type VoucherType } from '@neurobook/shared'
import { voucherStatusBadge, voucherTypeLabel } from '@/lib/voucher-ui'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'
import { StatCard, StatGrid } from '@/ui/StatCard'
import { buttonClass } from '@/ui/Button'

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
      <PageHeader icon={Icon} title={title} description={description}>
        <Link
          href={newHref}
          aria-disabled={!canRaise}
          onClick={(e) => {
            if (!canRaise) e.preventDefault()
          }}
          className={
            canRaise
              ? buttonClass('primary', 'md', 'capitalize')
              : 'flex items-center gap-1.5 rounded-lg bg-gray-100 px-3.5 py-2 text-sm font-semibold capitalize text-gray-400'
          }
        >
          <Plus size={15} aria-hidden />
          {newLabel}
        </Link>
      </PageHeader>

      <StatGrid className="mb-5 sm:grid-cols-3">
        <StatCard label="Entries" value={scoped.length} />
        <StatCard label="Drafts" value={drafts} tone="text-amber-600" />
        <StatCard label="Posted" value={posted} tone="text-emerald-600" />
      </StatGrid>

      {role && !canRaise && <RoleNotice>Your role can read these entries but not raise new ones.</RoleNotice>}

      <div className="mb-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search narration or voucher number"
          ariaLabel={`Search ${title}`}
          className="max-w-full"
        />
      </div>

      {error && <FormAlert message={error} />}

      <DataTable
        columns={[
          { key: 'number', label: 'Number' },
          { key: 'date', label: 'Date' },
          ...(types.length > 1 ? [{ key: 'type', label: 'Type' }] : []),
          { key: 'narration', label: 'Narration' },
          { key: 'status', label: 'Status' },
        ]}
        loading={loading}
        loadingLabel="Loading entries..."
        isEmpty={visible.length === 0}
        empty={
          scoped.length === 0 ? (
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
      </DataTable>
    </main>
  )
}