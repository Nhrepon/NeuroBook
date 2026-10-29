'use client'

import Button from '@/ui/Button'
import { FormAlert } from '@/ui/Field'
import Modal from '@/ui/Modal'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import { can, type Role } from '@neurobook/shared'
import { Package, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ProductForm from './ProductForm'
import ProductList, { type Category, type Product } from './ProductList'

type ProductFormState = { mode: 'create' } | { mode: 'edit'; product: Product }

export default function ProductsPage({ title = 'Products' }: { title?: string }) {
  const [rows, setRows] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [productForm, setProductForm] = useState<ProductFormState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // SKU management
  const [skuProductId, setSkuProductId] = useState<string | null>(null)
  const [skuList, setSkuList] = useState<{ id: string; sku: string }[]>([])
  const [skuLoading, setSkuLoading] = useState(false)
  const [skuText, setSkuText] = useState('')
  const [skuBarcode, setSkuBarcode] = useState('')
  const [skuSaving, setSkuSaving] = useState(false)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [skuNotice, setSkuNotice] = useState<string | null>(null)
  const skuScanRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/v1/products', { cache: 'no-store' }),
        fetch('/api/v1/categories', { cache: 'no-store' }),
      ])
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

  function openCreate() {
    if (!canWrite) return
    setError(null)
    setNotice(null)
    setProductForm({ mode: 'create' })
  }

  function openEdit(product: Product) {
    setError(null)
    setNotice(null)
    setProductForm({ mode: 'edit', product })
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setBusyId(product.id)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/v1/products?id=${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not delete the product.')
        return
      }
      setNotice(`Deleted "${product.name}".`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  async function openSkus(product: Product) {
    setSkuProductId(product.id)
    setSkuText('')
    setSkuBarcode('')
    setSkuError(null)
    setSkuNotice(null)
    setSkuLoading(true)
    try {
      const res = await fetch(`/api/v1/product-skus?productId=${encodeURIComponent(product.id)}`, { cache: 'no-store' })
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
    if (existing.includes(code) || skuList.some((s) => s.sku === code)) {
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
    if (list.length === 0) {
      setSkuError('Enter or scan at least one SKU.')
      return
    }
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
      if (!res.ok) {
        setSkuError(body?.error?.message ?? 'Could not save SKUs.')
        return
      }
      const created = Array.isArray(body.data) ? body.data : body.data ? [body.data] : []
      const skipped = Array.isArray(body.skipped) ? body.skipped : []
      let msg = `${created.length} SKU${created.length === 1 ? '' : 's'} added.`
      if (skipped.length > 0) msg += ` ${skipped.length} duplicate${skipped.length === 1 ? '' : 's'} skipped.`
      setSkuNotice(msg)
      setSkuText('')
      setSkuBarcode('')
      const product = rows.find((r) => r.id === skuProductId)
      if (product) await openSkus(product)
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
      const product = rows.find((r) => r.id === skuProductId)
      if (product) await openSkus(product)
      await load()
    } catch {
      setSkuError('Network error. Please try again.')
    }
  }

  const skuProduct = rows.find((r) => r.id === skuProductId) ?? null
  const productFormTarget = productForm?.mode === 'edit' ? productForm.product : null

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        icon={Package}
        title={title}
        description="Items you buy and sell, with pricing, stock thresholds and SKUs. Categories are managed from the Product categories screen."
      >
        {canWrite && (
          <Button type="button" onClick={openCreate}>
            <Plus size={15} aria-hidden />
            New product
          </Button>
        )}
      </PageHeader>

      {role && !canWrite && <RoleNotice>Your role can view products but not create them.</RoleNotice>}

      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</p>
      )}
      {error && <FormAlert message={error} />}

      <ProductList
        rows={rows}
        categories={categories}
        loading={loading}
        canWrite={canWrite}
        busyId={busyId}
        onEdit={openEdit}
        onDelete={removeProduct}
        onManageSkus={openSkus}
      />

      {productForm && (
        <Modal
          title={productForm.mode === 'create' ? 'New product' : `Edit ${productForm.product.name}`}
          size="xl"
          onClose={() => setProductForm(null)}
        >
          <ProductForm
            product={productFormTarget}
            categories={categories}
            onCancel={() => setProductForm(null)}
            onSaved={(name, created) => {
              setProductForm(null)
              setNotice(created ? `Product "${name}" added.` : `Saved "${name}".`)
              void load()
            }}
          />
        </Modal>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSkuText('')
                  setSkuNotice(null)
                  setSkuError(null)
                }}
              >
                Clear
              </Button>
            </>
          }
        >
          <form id="sku-form" onSubmit={addSkus}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Scan here</label>
              <input
                ref={skuScanRef}
                type="text"
                onKeyDown={onSkuScanKeyDown}
                placeholder="Scan a barcode..."
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">SKUs (one per line, or comma separated)</label>
              <textarea
                value={skuText}
                onChange={(e) => setSkuText(e.target.value)}
                rows={5}
                placeholder={'A4-500\nA4-80'}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
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
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>

            {skuError && <div className="mt-3"><FormAlert message={skuError} /></div>}
            {skuNotice && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{skuNotice}</p>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Existing SKUs</h3>
              {skuLoading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
              {!skuLoading && skuList.length === 0 && <p className="mt-2 text-sm text-gray-500">No SKUs yet.</p>}
              <ul className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto">
                {skuList.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span className="font-mono text-sm text-gray-800">{s.sku}</span>
                    <button
                      type="button"
                      onClick={() => deleteSku(s.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </form>
        </Modal>
      )}
    </main>
  )
}