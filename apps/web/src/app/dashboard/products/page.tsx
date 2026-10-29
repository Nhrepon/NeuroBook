'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Package, Plus, X } from 'lucide-react'
import { can, formatTaka, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import Card from '@/ui/Card'
import RoleNotice from '@/ui/RoleNotice'
import SearchInput from '@/ui/SearchInput'
import DataTable from '@/ui/DataTable'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'

interface Product {
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
}

interface Category {
  id: string
  name: string
}

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'box', 'pack', 'dozen', 'm', 'cm']

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

export default function ProductsPage({ title = 'Products' }: { title?: string }) {
  const [rows, setRows] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [code, setCode] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNameBn, setEditNameBn] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editReorderLevel, setEditReorderLevel] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

  // SKU management panel
  const [skuProductId, setSkuProductId] = useState<string | null>(null)
  const [skuList, setSkuList] = useState<{ id: string; sku: string }[]>([])
  const [skuLoading, setSkuLoading] = useState(false)
  const [skuText, setSkuText] = useState('')
  const [skuBarcode, setSkuBarcode] = useState('')
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
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.nameBn?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          r.skus.some((s) => s.toLowerCase().includes(q)),
      )
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
        body: JSON.stringify({
          name: name.trim(),
          nameBn: nameBn.trim() || undefined,
          code: code.trim() || undefined,
          sku: sku.trim() || undefined,
          category: category.trim() || undefined,
          unit: unit.trim() || undefined,
          price: price.trim() ? Math.round(Number(price) * 100) : undefined,
          costPrice: costPrice.trim() ? Math.round(Number(costPrice) * 100) : undefined,
          reorderLevel: reorderLevel.trim() ? Number(reorderLevel) : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the product.')
        return
      }
      setName(''); setNameBn(''); setCode(''); setSku(''); setCategory(''); setUnit(''); setPrice(''); setCostPrice(''); setReorderLevel('')
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
    setEditNameBn(row.nameBn ?? '')
    setEditCode(row.code ?? '')
    setEditCategory(row.category ?? '')
    setEditUnit(row.unit ?? '')
    setEditPrice(row.price ? (row.price / 100).toFixed(2) : '')
    setEditCostPrice(row.costPrice ? (row.costPrice / 100).toFixed(2) : '')
    setEditReorderLevel(row.reorderLevel ? String(row.reorderLevel) : '')
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
          nameBn: editNameBn.trim() === '' ? null : editNameBn.trim(),
          code: editCode.trim() === '' ? null : editCode.trim(),
          category: editCategory.trim() || undefined,
          unit: editUnit.trim() === '' ? null : editUnit.trim(),
          price: editPrice.trim() === '' ? 0 : Math.round(Number(editPrice) * 100),
          costPrice: editCostPrice.trim() === '' ? 0 : Math.round(Number(editCostPrice) * 100),
          reorderLevel: editReorderLevel.trim() === '' ? 0 : Number(editReorderLevel),
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
    setSkuBarcode('')
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
        body: JSON.stringify({
          productId: skuProductId,
          skus: list,
          barcode: list.length === 1 ? skuBarcode.trim() || undefined : undefined,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setSkuError(body?.error?.message ?? 'Could not save SKUs.'); return }
      const created = Array.isArray(body.data) ? body.data : (body.data ? [body.data] : [])
      const skipped = Array.isArray(body.skipped) ? body.skipped : []
      let msg = `${created.length} SKU${created.length === 1 ? '' : 's'} added.`
      if (skipped.length > 0) msg += ` ${skipped.length} duplicate${skipped.length === 1 ? '' : 's'} skipped.`
      setSkuNotice(msg)
      setSkuText('')
      setSkuBarcode('')
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
      <datalist id="product-categories">
        {categories.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>

      <PageHeader
        icon={Package}
        title={title}
        description="Items you buy and sell. Each item can have many SKUs (barcodes). Manage SKUs per item."
      >
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
      </PageHeader>

      {role && !canWrite && <RoleNotice>Your role can view products but not create them.</RoleNotice>}

      {showForm && canWrite && (
        <Modal
          title="New product"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <Button type="submit" form="new-product-form" loading={saving} disabled={!name.trim()}>
                {saving ? 'Saving...' : 'Save product'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </>
          }
        >
          <form id="new-product-form" onSubmit={create}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required placeholder="A4 Paper Ream" value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Name in Bangla" optional placeholder="এ৪ কাগজ" value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
              <Field label="Item code" optional placeholder="A4-500" value={code} onChange={(e) => setCode(e.target.value)} hint="Short human code. SKUs and barcodes are managed separately." />
              <Field label="Initial SKU (optional)" placeholder="A4-500" value={sku} onChange={(e) => setSku(e.target.value)} hint="Left blank, one is generated from the name." />
              <Field label="Category" optional value={category} onChange={(e) => setCategory(e.target.value)} list="product-categories" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Unit</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={controlClass}>
                  <option value="">—</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <Field label="Sale price (BDT)" optional placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} hint="Excluding VAT. Auto-fills invoice lines." />
              <Field label="Cost price (BDT)" optional placeholder="0.00" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} hint="Used for stock valuation and margin." />
              <Field label="Reorder level" optional inputMode="decimal" placeholder="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} hint="Flag the item when stock falls to this level." className="sm:col-span-2" />
            </div>
          </form>
        </Modal>
      )}

      {editingId && (
        <Card className="mb-5 border-blue-200 bg-blue-50/40 p-4 sm:p-5">
          <form onSubmit={(e) => { e.preventDefault(); void saveEdit() }}>
            <h2 className="text-sm font-semibold text-gray-900">Edit product</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" required value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Field label="Name in Bangla" optional value={editNameBn} onChange={(e) => setEditNameBn(e.target.value)} />
              <Field label="Item code" optional value={editCode} onChange={(e) => setEditCode(e.target.value)} />
              <Field label="Category" optional value={editCategory} onChange={(e) => setEditCategory(e.target.value)} list="product-categories" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Unit</label>
                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className={controlClass}>
                  <option value="">—</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <Field label="Sale price (BDT)" optional placeholder="0.00" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} hint="Excluding VAT." />
              <Field label="Cost price (BDT)" optional placeholder="0.00" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} hint="Used for stock valuation." />
              <Field label="Reorder level" optional inputMode="decimal" placeholder="0" value={editReorderLevel} onChange={(e) => setEditReorderLevel(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Active
              </label>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
              <Button type="submit" loading={editSaving} disabled={!editName.trim()}>
                {editSaving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {skuProductId && skuProduct && (
        <Modal
          title={`SKUs for ${skuProduct.name}`}
          subtitle="Scan or paste many SKUs. Duplicates are skipped."
          onClose={() => setSkuProductId(null)}
          footer={
            <>
              <Button type="submit" form="sku-form" loading={skuSaving} disabled={skuText.trim() === ''}>
                {skuSaving ? 'Saving...' : 'Add SKUs'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setSkuText(''); setSkuNotice(null); setSkuError(null) }}>
                Clear
              </Button>
            </>
          }
        >
          <form id="sku-form" onSubmit={addSkus}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Scan here</label>
              <input ref={skuScanRef} type="text" onKeyDown={onSkuScanKeyDown} placeholder="Scan a barcode..." autoFocus className={controlClass} />
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">SKUs (one per line, or comma separated)</label>
              <textarea value={skuText} onChange={(e) => setSkuText(e.target.value)} rows={5} placeholder={'A4-500\nA4-80'} className={`${controlClass} font-mono`} />
            </div>

            <div className="mt-3">
              <label htmlFor="sku-barcode" className="mb-1.5 block text-sm font-medium text-gray-700">
                Barcode <span className="font-normal text-gray-400">(optional, single SKU only)</span>
              </label>
              <input
                id="sku-barcode"
                value={skuBarcode}
                onChange={(e) => setSkuBarcode(e.target.value)}
                placeholder="Scanner value"
                className={`${controlClass} font-mono`}
              />
            </div>

            {skuError && <div className="mt-3"><FormAlert message={skuError} /></div>}
            {skuNotice && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{skuNotice}</p>}

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
          </form>
        </Modal>
      )}

      {showCategories && canWrite && (
        <Card className="mb-5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
          <p className="mt-1 text-xs text-gray-500">Add, rename or delete the categories used to group products.</p>
          <form onSubmit={addCategory} className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Field label="New category" placeholder="e.g. Stationery" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
            </div>
            <Button type="submit" loading={catSaving} disabled={!newCatName.trim()}>
              Add
            </Button>
          </form>
          {catError && <div className="mt-3"><FormAlert message={catError} /></div>}
          <ul className="mt-4 divide-y divide-gray-100">
            {categories.length === 0 && <li className="py-3 text-sm text-gray-500">No categories yet.</li>}
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                {editingCatId === c.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input autoFocus value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveCategory(c.id) } if (e.key === 'Escape') { setEditingCatId(null); setEditingCatName('') } }} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
                    <Button type="button" size="sm" onClick={() => saveCategory(c.id)} disabled={catSaving}>Save</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setEditingCatId(null); setEditingCatName('') }}>Cancel</Button>
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
        </Card>
      )}

      {error && <FormAlert message={error} />}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, code, category or SKU" className="max-w-sm flex-1" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name} ({categoryCounts.get(c.name) ?? 0})</option>)}
        </select>
        {(query || categoryFilter) && (
          <button type="button" onClick={() => { setQuery(''); setCategoryFilter('') }} className="text-xs font-semibold text-gray-500 hover:text-gray-700">Clear filters</button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'skus', label: 'SKUs' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions', align: 'right' },
        ]}
        loading={loading}
        loadingLabel="Loading products..."
        isEmpty={visible.length === 0}
        empty={rows.length === 0 ? 'No products yet. Add an item.' : 'No products match this search.'}
      >
        {visible.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50/70">
            <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{row.code || <span className="text-gray-300">—</span>}</td>
            <td className="px-4 py-2.5">
              <p className="font-medium text-gray-900">{row.name}</p>
              {row.nameBn && <p className="text-xs text-gray-500">{row.nameBn}</p>}
            </td>
            <td className="px-4 py-2.5 text-gray-700">{row.category || <span className="text-gray-400">—</span>}</td>
            <td className="px-4 py-2.5 text-gray-700">{row.unit || <span className="text-gray-400">—</span>}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatTaka(row.price)}</td>
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
      </DataTable>
    </main>
  )
}
