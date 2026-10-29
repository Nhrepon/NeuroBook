'use client'

import { useMemo, useState } from 'react'
import { formatTaka } from '@neurobook/shared'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'

export interface Product {
  id: string
  name: string
  nameBn: string | null
  code: string | null
  category: string | null
  unit: string | null
  price: number
  costPrice: number
  reorderLevel: number
  active: boolean
  skus: string[]
  /** Quantity from the stock ledger, so the list can flag and lock deletion. */
  onHand: number
  /** Any previous record — stock movement or invoice line — blocks deletion. */
  hasHistory: boolean
}

export interface Category {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  active: boolean
  productCount: number
}

type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'code-asc'
type StatusFilter = 'all' | 'active' | 'inactive'

const SORTS: [SortKey, string][] = [
  ['name-asc', 'Name A–Z'],
  ['name-desc', 'Name Z–A'],
  ['code-asc', 'Code'],
  ['price-asc', 'Price low → high'],
  ['price-desc', 'Price high → low'],
]

interface ProductListProps {
  rows: Product[]
  categories: Category[]
  loading: boolean
  canWrite: boolean
  busyId: string | null
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onManageSkus: (product: Product) => void
}

/** "Pacemaker / Single chamber" for each category name, if it has a parent. */
function categoryPaths(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const cache = new Map<string, string>()
  function label(id: string, seen = new Set<string>()): string {
    const cached = cache.get(id)
    if (cached) return cached
    const category = byId.get(id)
    if (!category || seen.has(id)) return ''
    seen.add(id)
    const name = category.parentId ? `${label(category.parentId, seen)} / ${category.name}` : category.name
    cache.set(id, name)
    return name
  }
  const out = new Map<string, string>()
  for (const c of categories) out.set(c.name, label(c.id) || c.name)
  return out
}

function marginPercent(price: number, cost: number): number | null {
  if (price <= 0 || cost <= 0) return null
  return Math.round(((price - cost) / price) * 100)
}

/**
 * Product master list: search, category and status filters, sorting, and the
 * fields needed to judge an item at a glance (code, names, pricing, margin,
 * reorder level, SKUs and status).
 */
export default function ProductList({
  rows,
  categories,
  loading,
  canWrite,
  busyId,
  onEdit,
  onDelete,
  onManageSkus,
}: ProductListProps) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('name-asc')

  const paths = useMemo(() => categoryPaths(categories), [categories])

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (r.category) m.set(r.category, (m.get(r.category) ?? 0) + 1)
    }
    return m
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows
      .filter((r) => !categoryFilter || r.category === categoryFilter)
      .filter((r) => statusFilter === 'all' || (statusFilter === 'active' ? r.active : !r.active))
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.nameBn?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          r.skus.some((s) => s.toLowerCase().includes(q)),
      )

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'price-asc':
          return a.price - b.price || a.name.localeCompare(b.name)
        case 'price-desc':
          return b.price - a.price || a.name.localeCompare(b.name)
        case 'code-asc':
          return (a.code ?? '~').localeCompare(b.code ?? '~') || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [rows, query, categoryFilter, statusFilter, sort])

  const hasFilters = Boolean(query || categoryFilter || statusFilter !== 'all' || sort !== 'name-asc')

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search name, code, category or SKU"
          className="max-w-sm flex-1"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {paths.get(c.name) ?? c.name} ({categoryCounts.get(c.name) ?? 0})
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort products"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setCategoryFilter('')
              setStatusFilter('all')
              setSort('name-asc')
            }}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'item', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit' },
          { key: 'pricing', label: 'Price / cost', align: 'right' },
          { key: 'margin', label: 'Margin', align: 'right' },
          { key: 'reorder', label: 'Reorder', align: 'right' },
          { key: 'stock', label: 'Stock', align: 'right' },
          { key: 'skus', label: 'SKUs' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading products..."
        isEmpty={visible.length === 0}
        empty={rows.length === 0 ? 'No products yet. Add an item.' : 'No products match these filters.'}
      >
        {visible.map((row) => {
          const margin = marginPercent(row.price, row.costPrice)
          return (
            <tr key={row.id} className="hover:bg-gray-50/70">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                {row.code || <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <p className="font-medium text-gray-900">{row.name}</p>
              </td>
              <td className="px-4 py-2.5 text-gray-700">
                {row.category ? paths.get(row.category) ?? row.category : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-700">{row.unit || <span className="text-gray-400">—</span>}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                <p className="text-gray-900">{formatTaka(row.price)}</p>
                {row.costPrice > 0 && <p className="text-xs text-gray-500">cost {formatTaka(row.costPrice)}</p>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {margin === null ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  <span className={margin < 0 ? 'text-red-600' : 'text-emerald-700'}>{margin}%</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                {row.reorderLevel > 0 ? row.reorderLevel : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.hasHistory ? (
                  <>
                    <span className={row.onHand < 0 ? 'text-red-600' : row.onHand === 0 ? 'text-gray-500' : 'text-gray-900'}>
                      {row.onHand}
                    </span>
                    {row.reorderLevel > 0 && row.onHand <= row.reorderLevel && (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">reorder</p>
                    )}
                  </>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onManageSkus(row)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {row.skus.length} SKU{row.skus.length === 1 ? '' : 's'}
                </button>
              </td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${row.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-300'}`}>
                  {row.active ? 'Active' : 'Inactive'}
                </span>
              </td>
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
                      disabled={busyId !== null || row.hasHistory}
                      title={row.hasHistory ? 'This product has previous records (stock or invoices) — deactivate it instead' : undefined}
                      className="text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                    >
                      {busyId === row.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </DataTable>

      {visible.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Showing {visible.length} of {rows.length} products
        </p>
      )}
    </>
  )
}