'use client'

import { useMemo, useState } from 'react'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'

export type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH'

export interface Party {
  id: string
  name: string
  type: PartyType
  email: string | null
  phone: string | null
  address: string | null
  active: boolean
}

const TYPE_BADGE: Record<PartyType, string> = {
  CUSTOMER: 'bg-blue-50 text-blue-700 ring-blue-200',
  SUPPLIER: 'bg-violet-50 text-violet-700 ring-violet-200',
  BOTH: 'bg-amber-50 text-amber-700 ring-amber-200',
}

const TYPE_LABEL: Record<PartyType, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  BOTH: 'Customer & supplier',
}

interface PartyListProps {
  rows: Party[]
  loading: boolean
  canWrite: boolean
  busyId: string | null
  onEdit: (party: Party) => void
  onDelete: (party: Party) => void
}

/** Searchable party table. Creating and editing happen in PartyForm. */
export default function PartyList({ rows, loading, canWrite, busyId, onEdit, onDelete }: PartyListProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | PartyType>('ALL')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => typeFilter === 'ALL' || r.type === typeFilter)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, query, typeFilter])

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, phone or email" className="max-w-sm flex-1" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'ALL' | PartyType)}
          aria-label="Filter by type"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
        >
          <option value="ALL">All types</option>
          <option value="CUSTOMER">Customers</option>
          <option value="SUPPLIER">Suppliers</option>
          <option value="BOTH">Both</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading parties..."
        isEmpty={visible.length === 0}
        empty={
          rows.length === 0
            ? 'No parties yet. Create one to bill customers or record supplier bills.'
            : 'No parties match this search.'
        }
      >
        {visible.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50/70">
            <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
            <td className="px-4 py-2.5">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_BADGE[row.type]}`}>
                {TYPE_LABEL[row.type]}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
              {row.phone || <span className="text-gray-400">—</span>}
            </td>
            <td className="px-4 py-2.5 text-gray-700">{row.email || <span className="text-gray-400">—</span>}</td>
            <td className="px-4 py-2.5 text-right">
              {canWrite && (
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onEdit(row)}
                    disabled={busyId !== null}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    disabled={busyId !== null}
                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    {busyId === row.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  )
}