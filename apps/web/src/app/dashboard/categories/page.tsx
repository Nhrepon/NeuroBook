'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Tags, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import Card from '@/ui/Card'
import RoleNotice from '@/ui/RoleNotice'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'

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
      <PageHeader
        icon={Tags}
        title="Product categories"
        description="Groups used to organise products and filter the product list."
      >
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
      </PageHeader>

      {role && !canWrite && <RoleNotice>Your role can view categories but not change them.</RoleNotice>}

      {showForm && canWrite && (
        <Card className="mb-5 p-4 sm:p-5">
          <form onSubmit={create}>
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
        </Card>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search categories" />
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'products', label: 'Products', align: 'right' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading categories..."
        isEmpty={visible.length === 0}
        empty={categories.length === 0 ? 'No categories yet. Add one to group your products.' : 'No categories match this search.'}
      >
        {visible.map((c) => (
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
      </DataTable>
    </main>
  )
}
