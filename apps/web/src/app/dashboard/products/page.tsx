'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2, Package, Plus, Search, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

interface Product {
  id: string
  name: string
  sku: string | null
  unit: string | null
  active: boolean
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Product[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/products')
      if (!res.ok) throw new Error('Could not load products')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'product:write') : true

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, query])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sku: sku.trim() || undefined, unit: unit.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the product.')
        return
      }
      setName('')
      setSku('')
      setUnit('')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Package size={22} className="text-blue-600" aria-hidden />
            Products
          </h1>
          <p className="mt-1 text-sm text-gray-500">Items and services you buy and sell, with their unit of measure.</p>
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
          {showForm ? 'Cancel' : 'New product'}
        </button>
      </header>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view products but not create them.
        </p>
      )}

      {showForm && canWrite && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">New product</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Name" required placeholder="A4 Paper Ream" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-3" />
            <Field label="SKU" optional placeholder="A4-500" value={sku} onChange={(e) => setSku(e.target.value)} hint="Stock keeping unit or barcode." />
            <Field label="Unit" optional placeholder="pcs / kg / box" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : 'Save product'}
            </button>
          </div>
        </form>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
        <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
        <input
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
          placeholder="Search name or SKU"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading products...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? 'No products yet. Add the items you trade.' : 'No products match this search.'}
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{row.sku || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2.5 text-gray-700">{row.unit || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          row.active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-600 ring-gray-300'
                        }`}
                      >
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
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
