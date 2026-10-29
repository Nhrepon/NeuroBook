'use client'

import { useMemo, useState } from 'react'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'

export interface CategoryRow {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  active: boolean
  productCount: number
}

interface CategoryListProps {
  categories: CategoryRow[]
  loading: boolean
  canWrite: boolean
  /** Id of the category currently being deleted, if any. */
  deletingId: string | null
  onEdit: (category: CategoryRow) => void
  onDelete: (category: CategoryRow) => void
}

interface TreeNode {
  category: CategoryRow
  depth: number
}

/** Depth-first order so children sit directly under their parent. */
function buildTree(categories: CategoryRow[]): TreeNode[] {
  const ids = new Set(categories.map((c) => c.id))
  const byParent = new Map<string | null, CategoryRow[]>()
  for (const c of categories) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null
    byParent.set(key, [...(byParent.get(key) ?? []), c])
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name))

  const out: TreeNode[] = []
  const seen = new Set<string>()
  function visit(parent: string | null, depth: number) {
    for (const category of byParent.get(parent) ?? []) {
      if (seen.has(category.id)) continue
      seen.add(category.id)
      out.push({ category, depth })
      visit(category.id, depth + 1)
    }
  }
  visit(null, 0)
  return out
}

/** "Pacemaker / Single chamber" for flat search results. */
function pathLabels(categories: CategoryRow[]): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const cache = new Map<string, string>()
  function label(id: string): string {
    const cached = cache.get(id)
    if (cached) return cached
    const category = byId.get(id)
    if (!category) return ''
    const name = category.parentId ? `${label(category.parentId)} / ${category.name}` : category.name
    cache.set(id, name)
    return name
  }
  for (const c of categories) label(c.id)
  return cache
}

/** Searchable category table. Editing and deleting are delegated to the page. */
export default function CategoryList({
  categories,
  loading,
  canWrite,
  deletingId,
  onEdit,
  onDelete,
}: CategoryListProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const tree = useMemo(() => buildTree(categories), [categories])
  const paths = useMemo(() => pathLabels(categories), [categories])

  const rows: TreeNode[] = useMemo(() => {
    if (!q) return tree
    return categories
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({ category, depth: 0 }))
  }, [categories, q, tree])

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, code or description" />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Category' },
          { key: 'products', label: 'Products', align: 'right' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading categories..."
        isEmpty={rows.length === 0}
        empty={
          categories.length === 0
            ? 'No categories yet. Add one to group your products.'
            : 'No categories match this search.'
        }
      >
        {rows.map(({ category, depth }) => (
          <tr key={category.id} className="hover:bg-gray-50/70">
            <td className="px-4 py-2.5">
              <div style={{ paddingLeft: depth * 18 }} className="flex flex-wrap items-center gap-x-2">
                {depth > 0 && <span className="text-gray-300" aria-hidden>↳</span>}
                <span className="font-medium text-gray-900">{category.name}</span>
                {category.code && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
                    {category.code}
                  </span>
                )}
              </div>
              {q && category.parentId && (
                <p className="text-[11px] text-gray-400">{paths.get(category.id)}</p>
              )}
              {category.description && !q && (
                <p className="mt-0.5 text-xs text-gray-500">{category.description}</p>
              )}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
              {category.productCount > 0 ? category.productCount : <span className="text-gray-300">0</span>}
            </td>
            <td className="px-4 py-2.5">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  category.active
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-gray-100 text-gray-600 ring-gray-300'
                }`}
              >
                {category.active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className="px-4 py-2.5 text-right">
              {canWrite && (
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onEdit(category)}
                    disabled={deletingId !== null}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(category)}
                    disabled={deletingId !== null}
                    className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === category.id ? 'Deleting...' : 'Delete'}
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