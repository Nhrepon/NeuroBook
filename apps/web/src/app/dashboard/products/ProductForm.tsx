'use client'

import { useState } from 'react'
import Field, { FormAlert } from '@/ui/Field'
import Button from '@/ui/Button'
import type { Category, Product } from './ProductList'

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'box', 'pack', 'dozen', 'm', 'cm']

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

interface ProductFormProps {
  /** Edit this product; omit (or null) to create a new one. */
  product?: Product | null
  categories: Category[]
  onSaved: (name: string, created: boolean) => void
  onCancel: () => void
}

/** Create or edit a product. SKUs are managed separately from the list. */
export default function ProductForm({ product, categories, onSaved, onCancel }: ProductFormProps) {
  const editing = Boolean(product)
  const [name, setName] = useState(product?.name ?? '')
  const [code, setCode] = useState(product?.code ?? '')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState(product?.category ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '')
  const [price, setPrice] = useState(product?.price ? (product.price / 100).toFixed(2) : '')
  const [costPrice, setCostPrice] = useState(product?.costPrice ? (product.costPrice / 100).toFixed(2) : '')
  const [reorderLevel, setReorderLevel] = useState(product?.reorderLevel ? String(product.reorderLevel) : '')
  const [active, setActive] = useState(product?.active ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()
  const valid = trimmed.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const money = (value: string) => (value.trim() === '' ? 0 : Math.round(Number(value) * 100))
      const body = editing
        ? {
            id: product!.id,
            name: trimmed,
            code: code.trim() === '' ? null : code.trim(),
            category: category.trim() || undefined,
            unit: unit.trim() === '' ? null : unit.trim(),
            price: money(price),
            costPrice: money(costPrice),
            reorderLevel: reorderLevel.trim() === '' ? 0 : Number(reorderLevel),
            active,
          }
        : {
            name: trimmed,
            code: code.trim() || undefined,
            sku: sku.trim() || undefined,
            category: category.trim() || undefined,
            unit: unit.trim() || undefined,
            price: price.trim() ? money(price) : undefined,
            costPrice: costPrice.trim() ? money(costPrice) : undefined,
            reorderLevel: reorderLevel.trim() ? Number(reorderLevel) : undefined,
          }

      const res = await fetch('/api/v1/products', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error?.message ?? 'Could not save the product.')
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
      <datalist id="product-categories-form">
        {categories.filter((c) => c.active).map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required autoFocus placeholder="A4 Paper Ream" value={name} onChange={(e) => setName(e.target.value)} />
        <Field
          label="Item code"
          optional
          placeholder="A4-500"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          hint={editing ? 'Leave blank to generate a new automatic code.' : 'Leave blank to generate automatically. Codes are unique per company.'}
        />
        {!editing && (
          <Field
            label="Initial SKU (optional)"
            placeholder="A4-500"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            hint="Left blank, one is generated from the name."
          />
        )}
        <Field
          label="Category"
          optional
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="product-categories-form"
        />
        <div>
          <label htmlFor="product-unit" className="mb-1.5 block text-sm font-medium text-gray-700">
            Unit
          </label>
          <select
            id="product-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={controlClass}
          >
            <option value="">—</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Sale price (BDT)"
          optional
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Excluding VAT. Auto-fills invoice lines."
        />
        <Field
          label="Cost price (BDT)"
          optional
          placeholder="0.00"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          hint="Used for stock valuation and margin."
        />
        <Field
          label="Reorder level"
          optional
          inputMode="decimal"
          placeholder="0"
          value={reorderLevel}
          onChange={(e) => setReorderLevel(e.target.value)}
          hint="Flag the item when stock falls to this level."
          className="sm:col-span-2"
        />
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Active
        </label>
      )}

      {error && <FormAlert message={error} />}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <Button type="submit" loading={busy} disabled={!valid}>
          {busy ? 'Saving...' : editing ? 'Save changes' : 'Save product'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}