'use client'

import { useMemo, useState } from 'react'
import Field, { FormAlert } from '@/ui/Field'
import Button from '@/ui/Button'
import type { CategoryRow } from './CategoryList'

export interface CategoryFormValue {
  id: string
  name: string
  code: string | null
  description: string | null
  parentId: string | null
  active: boolean
}

interface CategoryFormProps {
  /** The category being edited; omit (or null) to create a new one. */
  category?: CategoryFormValue | null
  /** Every category in the company, used for the parent picker and duplicates. */
  categories: CategoryRow[]
  onSaved: (name: string, created: boolean) => void
  onCancel: () => void
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

/** All ids beneath `rootId`, so a category cannot be moved into its own subtree. */
function descendantsOf(rootId: string, all: CategoryRow[]): Set<string> {
  const children = new Map<string, string[]>()
  for (const c of all) {
    if (!c.parentId) continue
    children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id])
  }
  const out = new Set<string>()
  const stack = [...(children.get(rootId) ?? [])]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (out.has(id)) continue
    out.add(id)
    stack.push(...(children.get(id) ?? []))
  }
  return out
}

/** "Pacemaker / Single chamber" labels for the parent picker. */
function pathLabels(all: CategoryRow[]): Map<string, string> {
  const byId = new Map(all.map((c) => [c.id, c]))
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
  for (const c of all) label(c.id)
  return cache
}

/**
 * One form for creating and editing a product category, including its parent in
 * the hierarchy, a company code, a description and active/inactive state.
 */
export default function CategoryForm({ category, categories, onSaved, onCancel }: CategoryFormProps) {
  const editing = Boolean(category)
  const [name, setName] = useState(category?.name ?? '')
  const [code, setCode] = useState(category?.code ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [parentId, setParentId] = useState(category?.parentId ?? '')
  const [active, setActive] = useState(category?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim().replace(/\s+/g, ' ')
  const duplicate = categories.some(
    (c) => c.id !== category?.id && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  const valid = trimmed.length > 0 && !duplicate

  const blocked = useMemo(
    () => (category ? descendantsOf(category.id, categories) : new Set<string>()),
    [category, categories],
  )
  const labels = useMemo(() => pathLabels(categories), [categories])
  const options = useMemo(
    () =>
      categories
        .filter((c) => c.id !== category?.id && !blocked.has(c.id))
        .sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name)),
    [categories, category, blocked, labels],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: trimmed,
        code: code.trim() || null,
        description: description.trim() || null,
        parentId: parentId || null,
        active,
      }
      const res = await fetch('/api/v1/categories', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { id: category!.id, ...payload } : payload),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not save the category.')
        return
      }
      onSaved(trimmed, !editing)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          required
          autoFocus
          placeholder="e.g. Single chamber"
          value={name}
          maxLength={64}
          onChange={(e) => setName(e.target.value)}
          hint="Unique per company, ignoring case."
        />
        <Field
          label="Code"
          optional
          placeholder="PACE-SC"
          value={code}
          maxLength={32}
          onChange={(e) => setCode(e.target.value)}
          hint="Short reference used on lists and reports."
        />
        <div className="sm:col-span-2">
          <label htmlFor="category-parent" className="mb-1.5 block text-sm font-medium text-gray-700">
            Parent category
          </label>
          <select
            id="category-parent"
            className={controlClass}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— Top level —</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {labels.get(c.id) ?? c.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-gray-400">
            Group related items, for example Pacemaker → Single chamber, Dual chamber.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="category-description" className="mb-1.5 block text-sm font-medium text-gray-700">
            Description <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="category-description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What belongs in this category?"
            className={controlClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Active — offered when creating products
      </label>

      {duplicate && trimmed.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          &ldquo;{trimmed}&rdquo; is already used by another category.
        </p>
      )}

      {error && <FormAlert message={error} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <Button type="submit" loading={busy} disabled={!valid}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Add category'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}