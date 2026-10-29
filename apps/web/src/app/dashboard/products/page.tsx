'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Barcode, Loader2, Package, Plus, Search, Trash2, X } from 'lucide-react'
import { can, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'

interface Product {
  id: string
  name: string
  category: string | null
  unit: string | null
  price: number
  active: boolean
  skus: string[]
}

interface Category {
  id: string
  name: string
}

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'box', 'pack', 'dozen', 'm', 'cm']

export default function ProductsPage({ title = 'Products' }: { title?: string }) {
  const [rows, setRows] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  // SKU management panel
  const [skuProductId, setSkuProductId] = useState<string | null>(null)
  const [skuList, setSkuList] = useState<{ id: string; sku: string }[]>([])
  const [skuLoading, setSkuLoading] = useState(false)
  const [skuText, setSkuText] = useState('')
  const [skuSaving, setSkuSaving] = useState(false)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [skuNotice, setSkuNotice] = useState<string | null>(null)
  const skuScanRef = useRef<HTMLInputElement>(null)

  const [showCategories, setShowCategories] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')

  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([fetch('/api/v1/products', { cache: 'no-store' }), fetch('/api/v1/categories', { cache: 'no-store' })])
      if (!pRes.ok) throw new Error('Could not load products')
      const pJson = await pRes.json()
      setRows(pJson.data ?? [])
      if (cRes.ok) {
        const cJson = await cRes.json()
        setCategories(cJson.data ?? [])
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load products')
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => !categoryFilter || r.category === categoryFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q) || r.skus.some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows, query, categoryFilter])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sku: sku.trim() || undefined, category: category.trim() || undefined, unit: unit.trim() || undefined, price: price.trim() ? Math.round(Number(price) * 100) : undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the product.')
        return
      }
      setName(''); setSku(''); setCategory(''); setUnit(''); setPrice('')
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row: Product) {
    setEditingId(row.id)
    setEditName(row.name)
    setEditCategory(row.category ?? '')
    setEditUnit(row.unit ?? '')
    setEditPrice(row.price ? (row.price / 100).toFixed(2) : '')
    setEditActive(row.active)
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return
    setEditSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          name: editName.trim(),
          category: editCategory.trim() || undefined,
          unit: editUnit.trim() === '' ? null : editUnit.trim(),
          price: editPrice.trim() === '' ? 0 : Math.round(Number(editPrice) * 100),
          active: editActive,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the product.')
        return
      }
      setEditingId(null)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setError(null)
    try {
      const res = await fetch(`/api/v1/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not delete the product.')
        return
      }
      await load()
    } catch {
      setError('Network error. Please try again.')
    }
  }

  async function openSkus(productId: string) {
    setSkuProductId(productId)
    setSkuText('')
    setSkuError(null)
    setSkuNotice(null)
    setSkuLoading(true)
    try {
      const res = await fetch(`/api/v1/product-skus?productId=${encodeURIComponent(productId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load SKUs')
      const json = await res.json()
      setSkuList(json.data ?? [])
    } catch (e) {
      setSkuError(e instanceof Error ? e.message : 'Could not load SKUs')
    } finally {
      setSkuLoading(false)
    }
  }

  function onSkuScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = (e.currentTarget.value ?? '').trim()
    if (!code) return
    const existing = skuText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    const alreadyInList = existing.includes(code)
    const alreadySaved = skuList.some((s) => s.sku === code)
    if (alreadyInList || alreadySaved) {
      setSkuNotice(`Skipped duplicate SKU: ${code}`)
      e.currentTarget.value = ''
      return
    }
    setSkuText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${code}` : code))
    e.currentTarget.value = ''
  }

  async function addSkus(e: React.FormEvent) {
    e.preventDefault()
    if (!skuProductId) return
    const list = skuText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    if (list.length === 0) { setSkuError('Enter or scan at least one SKU.'); return }
    setSkuSaving(true)
    setSkuError(null)
    setSkuNotice(null)
    try {
      const res = await fetch('/api/v1/product-skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: skuProductId, skus: list }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setSkuError(body?.error?.message ?? 'Could not save SKUs.'); return }
      const created = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [])
      const skipped = Array.isArray(body.skipped) ? body.skipped : []
      let msg = `${created.length} SKU${created.length === 1 ? '' : 's'} added.`
      if (skipped.length > 0) msg += ` ${skipped.length} duplicate${skipped.length === 1 ? '' : 's'} skipped.`
      setSkuNotice(msg)
      setSkuText('')
      await openSkus(skuProductId)
      await load()
    } catch {
      setSkuError('Network error. Please try again.')
    } finally {
      setSkuSaving(false)
    }
  }

  async function deleteSku(id: string) {
    setSkuError(null)
    try {
      const res = await fetch(`/api/v1/product-skus?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setSkuError(body?.error?.message ?? 'Could not delete SKU.')
        return
      }
      if (skuProductId) await openSkus(skuProductId)
      await load()
    } catch {
      setSkuError('Network error. Please try again.')
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim() || !canWrite) return
    setCatSaving(true)
    setCatError(null)
    try {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setCatError(body?.error?.message ?? 'Could not save category.'); return }
      setNewCatName('')
      await load()
    } catch {
      setCatError('Network error. Please try again.')
    } finally {
      setCatSaving(false)
    }
  }

  async function saveCategory(id: string) {
    if (!editingCatName.trim()) return
    setCatSaving(true)
    setCatError(null)
    try {
      const res = await fetch('/api/v1/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: editingCatName.trim() }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setCatError(body?.error?.message ?? 'Could not rename category.'); return }
      setEditingCatId(null)
      setEditingCatName('')
      await load()
    } catch {
      setCatError('Network error. Please try again.')
    } finally {
      setCatSaving(false)
    }
  }

  async function deleteCategory(id: string, name: string) {
    const count = categoryCounts.get(name) ?? 0
    const msg = count > 0
      ? `Delete category "${name}"? ${count} product${count === 1 ? '' : 's'} will lose this category.`
      : `Delete category "${name}"?`
    if (!window.confirm(msg)) return
    setCatSaving(true)
    setCatError(null)
    try {
      const res = await fetch(`/api/v1/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setCatError(body?.error?.message ?? 'Could not delete category.'); return }
      await load()
    } catch {
      setCatError('Network error. Please try again.')
    } finally {
      setCatSaving(false)
    }
  }

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => { if (r.category) m.set(r.category, (m.get(r.category) ?? 0) + 1) })
    return m
  }, [rows])

  const skuProduct = rows.find((r) => r.id === skuProductId) ?? null

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Package size={22} className="text-blue-600" aria-hidden />
            {title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Items you buy and sell. Each item can have many SKUs (barcodes). Manage SKUs per item.</p>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <>
              <button type="button" onClick={() => { setShowCategories((v) => !v); setShowForm(false) }} className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-sm transition ${showCategories ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                Manage categories
              </button>
              <button type="button" onClick={() => { setShowForm((v) => !v); setShowCategories(false) }} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                {showForm ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
                {showForm ? 'Cancel' : 'New product'}
              </button>
            </>
          )}
        </div>
      </header>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view products but not create them.
        </p>
      )}

      {showForm && canWrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">New product</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} aria-hidden /></button>
            </div>
            <form onSubmit={create} className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required placeholder="A4 Paper Ream" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-2" />
                <Field label="Initial SKU (optional)" placeholder="A4-500" value={sku} onChange={(e) => setSku(e.target.value)} hint="Barcode / stock keeping unit." />
                <Field label="Category" optional value={category} onChange={(e) => setCategory(e.target.value)} list="product-categories" />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Unit</label>
                  <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25">
                    <option value="">—</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <Field label="Default price (BDT)" optional placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} hint="Excluding VAT. Auto-fills invoice lines." />
              </div>
              <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                <button type="submit" disabled={!name.trim() || saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
                  {saving ? 'Saving...' : 'Save product'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingId && (
        <form onSubmit={(e) => { e.preventDefault(); void saveEdit() }} className="mb-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Edit product</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Field label="Category" optional value={editCategory} onChange={(e) => setEditCategory(e.target.value)} list="product-categories" />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Unit</label>
              <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25">
                <option value="">—</option>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Field label="Default price (BDT)" optional placeholder="0.00" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} hint="Excluding VAT." />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Active
            </label>
          </div>
          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <button type="submit" disabled={!editName.trim() || editSaving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {editSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {skuProductId && skuProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">SKUs for {skuProduct.name}</h2>
                <p className="mt-1 text-xs text-gray-500">Scan or paste many SKUs. Duplicates are skipped.</p>
              </div>
              <button type="button" onClick={() => setSkuProductId(null)} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} aria-hidden /></button>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Scan here</label>
              <input ref={skuScanRef} type="text" onKeyDown={onSkuScanKeyDown} placeholder="Scan a barcode..." autoFocus className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25" />
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">SKUs (one per line, or comma separated)</label>
              <textarea value={skuText} onChange={(e) => setSkuText(e.target.value)} rows={5} placeholder={'A4-500\nA4-80'} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25" />
            </div>

            {skuError && <div className="mt-3"><FormAlert message={skuError} /></div>}
            {skuNotice && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{skuNotice}</p>}

            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={addSkus} disabled={skuSaving || skuText.trim() === ''} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {skuSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {skuSaving ? 'Saving...' : 'Add SKUs'}
              </button>
              <button type="button" onClick={() => { setSkuText(''); setSkuNotice(null); setSkuError(null) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Clear</button>
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Existing SKUs</h3>
              {skuLoading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
              {!skuLoading && skuList.length === 0 && <p className="mt-2 text-sm text-gray-500">No SKUs yet.</p>}
              <ul className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto">
                {skuList.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span className="font-mono text-sm text-gray-800">{s.sku}</span>
                    <button type="button" onClick={() => deleteSku(s.id)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showCategories && canWrite && (
        <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
          <p className="mt-1 text-xs text-gray-500">Add, rename or delete the categories used to group products.</p>
          <form onSubmit={addCategory} className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Field label="New category" placeholder="e.g. Stationery" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            </div>
            <button type="submit" disabled={!newCatName.trim() || catSaving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {catSaving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              Add
            </button>
          </form>
          {catError && <div className="mt-3"><FormAlert message={catError} /></div>}
          <ul className="mt-4 divide-y divide-gray-100">
            {categories.length === 0 && <li className="py-3 text-sm text-gray-500">No categories yet.</li>}
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                {editingCatId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input autoFocus value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveCategory(c.id) } if (e.key === 'Escape') { setEditingCatId(null); setEditingCatName('') } }} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
                    <button type="button" onClick={() => saveCategory(c.id)} disabled={catSaving} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => { setEditingCatId(null); setEditingCatName('') }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-900">{c.name} <span className="ml-1 text-xs text-gray-400">({categoryCounts.get(c.name) ?? 0})</span></span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setEditingCatId(c.id); setEditingCatName(c.name) }} className="text-xs font-semibold text-blue-600 hover:underline">Rename</button>
                      <button type="button" onClick={() => deleteCategory(c.id, c.name)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
          <Search size={15} className="shrink-0 text-gray-400" aria-hidden />
          <input className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-gray-400" placeholder="Search name, category or SKU" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name} ({categoryCounts.get(c.name) ?? 0})</option>)}
        </select>
        {(query || categoryFilter) && (
          <button type="button" onClick={() => { setQuery(''); setCategoryFilter('') }} className="text-xs font-semibold text-gray-500 hover:text-gray-700">Clear filters</button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium">SKUs</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" aria-hidden /> Loading products...</span>
                  </td>
                </tr>
              )}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    {rows.length === 0 ? 'No products yet. Add an item.' : 'No products match this search.'}
                  </td>
                </tr>
              )}
              {!loading && visible.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-2.5 text-gray-700">{row.category || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-gray-700">{row.unit || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => openSkus(row.id)} className="text-xs font-semibold text-blue-600 hover:underline">
                      {row.skus.length} SKU{row.skus.length === 1 ? '' : 's'} · manage
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
                        <button type="button" onClick={() => startEdit(row)} className="text-xs font-semibold text-blue-600 hover:underline">Edit</button>
                        <button type="button" onClick={() => deleteProduct(row.id, row.name)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="product-categories">
        {categories.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>
    </main>
  )
}