'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { formatTaka } from '@neurobook/shared'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'
import { StatCard, StatGrid } from '@/ui/StatCard'

export interface StockRow {
  id: string
  name: string
  category: string | null
  unit: string | null
  price: number
  costPrice: number
  reorderLevel: number
  active: boolean
  skus: string[]
  purchased: number
  sold: number
  adjusted: number
  transferred: number
  onHand: number
  stockValue: number
  lastMovedAt: string | null
}

export interface StockMovement {
  id: string
  kind: 'in' | 'out' | 'transfer' | 'adjustment'
  date: string
  quantity: number
  unitCost: number
  reference: string | null
  description: string | null
  warehouse: string | null
  toWarehouse: string | null
}

export interface StockDetail {
  product: StockRow
  totals: { purchased: number; sold: number; adjusted: number; onHand: number; stockValue: number }
  movements: StockMovement[]
}

export function stockBadge(onHand: number) {
  if (onHand > 0) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (onHand < 0) return 'bg-red-50 text-red-700 ring-red-200'
  return 'bg-gray-100 text-gray-600 ring-gray-300'
}

export function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export const KIND_META: Record<StockMovement['kind'], { label: string; className: string }> = {
  in: { label: 'Stock in', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  out: { label: 'Stock out', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  transfer: { label: 'Transfer', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  adjustment: { label: 'Adjustment', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
}

type StatusFilter = 'all' | 'in' | 'out' | 'negative'

const STATUS_OPTIONS: [StatusFilter, string][] = [
  ['all', 'All'],
  ['in', 'In stock'],
  ['out', 'Out'],
  ['negative', 'Negative'],
]

interface StockListProps {
  rows: StockRow[]
  loading: boolean
  canWrite: boolean
  onDetail: (row: StockRow) => void
  onAdjust: (row: StockRow) => void
}

/** Stock KPI strip, filters and on-hand table. Actions are delegated to the page. */
export default function StockList({ rows, loading, canWrite, onDetail, onAdjust }: StockListProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status === 'in' && r.onHand <= 0) return false
      if (status === 'out' && r.onHand !== 0) return false
      if (status === 'negative' && r.onHand >= 0) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.skus.some((s) => s.toLowerCase().includes(q))
      )
    })
  }, [rows, query, status])

  const stats = useMemo(() => {
    let inStock = 0
    let out = 0
    let negative = 0
    let low = 0
    let units = 0
    let value = 0
    for (const r of rows) {
      if (r.onHand > 0) inStock += 1
      else if (r.onHand < 0) negative += 1
      else out += 1
      if (r.reorderLevel > 0 && r.onHand <= r.reorderLevel) low += 1
      units += r.onHand
      value += r.stockValue
    }
    return { items: rows.length, inStock, out, negative, low, units, value }
  }, [rows])

  return (
    <>
      <StatGrid className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Products" value={stats.items} />
        <StatCard label="In stock" value={stats.inStock} tone="text-emerald-600" />
        <StatCard label="Low stock" value={stats.low} tone="text-amber-600" />
        <StatCard label="Out of stock" value={stats.out} />
        <StatCard label="Units on hand" value={stats.units} />
        <StatCard label="Stock value" value={formatTaka(stats.value)} />
      </StatGrid>

      {stats.negative > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          {stats.negative} product{stats.negative === 1 ? '' : 's'} show negative stock — sales exceeded purchases. Check entries or adjust.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, category or SKU" className="max-w-sm flex-1" />
        <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1">
          {STATUS_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                status === value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'product', label: 'Product' },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit' },
          { key: 'purchased', label: 'Purchased', align: 'right' },
          { key: 'sold', label: 'Sold', align: 'right' },
          { key: 'adjusted', label: 'Adjusted', align: 'right' },
          { key: 'onHand', label: 'On hand', align: 'right' },
          { key: 'value', label: 'Value', align: 'right' },
          { key: 'last', label: 'Last movement' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading stock..."
        isEmpty={visible.length === 0}
        empty={rows.length === 0 ? 'No products yet. Add products to track stock.' : 'No items match this filter.'}
      >
        {visible.map((row) => (
          <tr key={row.id} onClick={() => onDetail(row)} className="cursor-pointer hover:bg-gray-50/70">
            <td className="px-4 py-2.5">
              <p className="font-medium text-gray-900">
                {row.name}
                {!row.active && <span className="ml-2 text-xs font-normal text-gray-400">inactive</span>}
              </p>
              <p className="font-mono text-[11px] text-gray-400">
                {row.skus.length > 0 ? row.skus.join(', ') : 'no SKU'}
              </p>
            </td>
            <td className="px-4 py-2.5 text-gray-700">{row.category || <span className="text-gray-400">—</span>}</td>
            <td className="px-4 py-2.5 text-gray-700">{row.unit || <span className="text-gray-400">—</span>}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{row.purchased || <span className="text-gray-300">0</span>}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-blue-700">{row.sold || <span className="text-gray-300">0</span>}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">
              {row.adjusted ? (row.adjusted > 0 ? `+${row.adjusted}` : row.adjusted) : <span className="text-gray-300">0</span>}
            </td>
            <td className="px-4 py-2.5 text-right">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${stockBadge(row.onHand)}`}>
                {row.onHand}
              </span>
              {row.reorderLevel > 0 && row.onHand <= row.reorderLevel && (
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600">reorder</p>
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatTaka(row.stockValue)}</td>
            <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(row.lastMovedAt)}</td>
            <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onDetail(row)}
                className="text-xs font-semibold text-gray-600 hover:underline"
              >
                Details
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onAdjust(row)}
                  className="ml-3 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Adjust
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  )
}