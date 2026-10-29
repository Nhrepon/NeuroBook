'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Plus, Search, Tags, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  category: string | null
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([
        fetch('/api/v1/categories', { cache: 'no-store' }),
        fetch('/api/v1/products', { cache: 'no-store' }),
      ])
      if (!cRes.ok) throw new Error('Could not load categories')
      const cJson = await cRes.json()
      setCategories(cJson.data ?? [])
      if (pRes.ok) {
        const pJson = await pRes.json()
        setProducts(pJson.data ?? [])
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load categories')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'product:write') : true

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    products.forEach((p) => {
      if (p.category) m.set(p.category, (m.get(p.category) ?? 0) + 1)
    })
    return m
  }, [products])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name))
  }, [categories, query])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim() || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not save category.')
        return
      }
      setNewCatName('')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    if (!editingName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editingName.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not rename category.')
        return
      }
      setEditingId(null)
      setEditingName('')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, name: string) {
    const count = counts.get(name) ?? 0
    const msg = count > 0
      ? `Delete category "${name}"? ${count} product${count === 1 ? '' : 's'} will lose this category.`
      : `Delete category "${name}"?`
    if (!window.confirm(msg)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not delete category.')
        return
      }
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Tags size={22} className="text-blue-600" aria-hidden />
            Product categories
          </h1>
          <p className="mt-1 text-sm text-gray-500">Groups used to organise products and filter the product list.</p>
        </div>

        <button
          type="button"
          onClick={() => canWrite && setShowForm((v) => !v)}
          aria-disabled={!canWrite}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
            canWrite ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
          }`}
        >
          {showForm ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
          {showForm ? 'Cancel' : 'New category'}
        </button>
      </header>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view categories but not change them.
        </p>
      )}

      {showForm && canWrite && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">New category</h2>
          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Name" required placeholder="e.g. Stationery" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            </div>
            <button type="submit" disabled={!newCatName.trim() || saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Save category'}
            </button>
          </div>
        </form>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex min-w-[200px] max-w-sm items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
        <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
        <input className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400" placeholder="Search categories" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search categories" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Products</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading categories...
                    </span>
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-gray-500">
                    {categories.length === 0 ? 'No categories yet. Add one to group your products.' : 'No categories match this search.'}
                  </td>
                </tr>
              )}
              {!loading &&
                visible.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {editingId === c.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              void saveEdit(c.id)
                            }
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
                        />
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{counts.get(c.name) ?? 0}</td>
                    <td className="px-4 py-2.5 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-3">
                          {editingId === c.id ? (
                            <>
                              <button type="button" onClick={() => saveEdit(c.id)} disabled={saving} className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50">Save</button>
                              <button type="button" onClick={() => { setEditingId(null); setEditingName('') }} className="text-xs font-semibold text-gray-500 hover:underline">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => { setEditingId(c.id); setEditingName(c.name) }} className="text-xs font-semibold text-blue-600 hover:underline">Rename</button>
                              <button type="button" onClick={() => remove(c.id, c.name)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                            </>
                          )}
                        </div>
                      )}
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
