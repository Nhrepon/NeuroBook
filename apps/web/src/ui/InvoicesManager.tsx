'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, Receipt, Trash2, X } from 'lucide-react'
import { VAT_RATES, formatTaka, toMinor } from '@neurobook/shared'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'
import Field, { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import DataTable from '@/ui/DataTable'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import InvoiceSettlement, { type SettleTarget } from '@/ui/InvoiceSettlement'
import type { LedgerAccount } from '@/ui/AccountPicker'

interface InvoiceRow {
  id: string
  customerId: string | null
  type: 'sale' | 'purchase'
  number: string | null
  date: string
  total: number
  vat: number
  paid: number
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'cancelled'
  lineCount: number
}

interface Product {
  id: string
  name: string
  unit: string | null
  price: number
  skus: string[]
}

interface Item {
  key: string
  productId: string
  description: string
  quantity: string
  unitPrice: string
  vatRate: string // percent
}

type FixedType = 'ALL' | 'sale' | 'purchase'

const STATUS_BADGE: Record<InvoiceRow['status'], string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  partially_paid: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-300',
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

export default function InvoicesManager({ fixedType = 'ALL' }: { fixedType?: FixedType }) {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [partyTypes, setPartyTypes] = useState<Record<string, 'CUSTOMER' | 'SUPPLIER' | 'BOTH'>>({})
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [type, setType] = useState<'sale' | 'purchase'>(fixedType === 'purchase' ? 'purchase' : 'sale')
  const [customer, setCustomer] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [number, setNumber] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)

  const [posting, setPosting] = useState<InvoiceRow | null>(null)
  const [settling, setSettling] = useState<SettleTarget | null>(null)
  const [arAccountId, setArAccountId] = useState('')
  const [revenueAccountId, setRevenueAccountId] = useState('')
  const [apAccountId, setApAccountId] = useState('')
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [vatAccountId, setVatAccountId] = useState('')
  const [postBusy, setPostBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'sale' | 'purchase'>(fixedType === 'ALL' ? 'ALL' : fixedType)

  const seq = useRef(0)
  const skuScanRef = useRef<HTMLInputElement>(null)
  function newItem(): Item {
    seq.current += 1
    return { key: `i${Date.now()}-${seq.current}`, productId: '', description: '', quantity: '1', unitPrice: '', vatRate: '0' }
  }

  function onInvoiceSkuScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = (e.currentTarget.value ?? '').trim()
    if (!code) return
    const product = products.find((p) => p.skus?.some((s) => s.toLowerCase() === code.toLowerCase()))
    if (!product) {
      setError(`No item found for SKU "${code}".`)
      e.currentTarget.value = ''
      return
    }
    // Add a new line (or fill first empty line)
    const emptyIdx = items.findIndex((i) => !i.productId && !i.description.trim())
    const line: Item = { key: `i${Date.now()}-${++seq.current}`, productId: product.id, description: product.name, quantity: '1', unitPrice: product.price > 0 ? (product.price / 100).toFixed(2) : '', vatRate: '0' }
    if (emptyIdx >= 0) {
      setItems((rows) => rows.map((r, idx) => (idx === emptyIdx ? line : r)))
    } else {
      setItems((rows) => [...rows, line])
    }
    e.currentTarget.value = ''
  }

  const arAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'ASSET'), [accounts])
  const revenueAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'REVENUE'), [accounts])
  const vatAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'LIABILITY'), [accounts])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/invoices')
      if (!res.ok) throw new Error('Could not load invoices')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    fetch('/api/v1/parties')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const map: Record<string, string> = {}
        const types: Record<string, 'CUSTOMER' | 'SUPPLIER' | 'BOTH'> = {}
        for (const p of j?.data ?? []) { map[p.id] = p.name; types[p.id] = p.type }
        setCustomers(map)
        setPartyTypes(types)
      })
      .catch(() => {})

    fetch('/api/v1/products')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setProducts(j?.data ?? []))
      .catch(() => {})

    fetch('/api/v1/accounts')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('accounts'))))
      .then((j) => {
        const list: LedgerAccount[] = j.data ?? []
        setAccounts(list)
        setArAccountId(list.find((a) => a.code === '1200')?.id ?? list.find((a) => a.type === 'ASSET' && !a.isGroup)?.id ?? '')
        setRevenueAccountId(list.find((a) => a.code === '4000')?.id ?? list.find((a) => a.type === 'REVENUE' && !a.isGroup)?.id ?? '')
        setVatAccountId(list.find((a) => a.code === '2100')?.id ?? list.find((a) => a.type === 'LIABILITY' && !a.isGroup)?.id ?? '')
        setApAccountId(list.find((a) => a.code === '2200')?.id ?? list.find((a) => a.type === 'LIABILITY' && !a.isGroup)?.id ?? '')
        setExpenseAccountId(list.find((a) => a.code === '5000')?.id ?? list.find((a) => a.type === 'EXPENSE' && !a.isGroup)?.id ?? '')
      })
      .catch(() => {})
  }, [])

  /** Next free `INV-/BILL-<year>-NNNN` for the given type, based on existing invoices. */
  function nextNumber(t: 'sale' | 'purchase') {
    const prefix = t === 'purchase' ? 'BILL' : 'INV'
    const year = new Date().getFullYear()
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)
    let max = 0
    for (const r of rows) {
      if (r.type !== t || !r.number) continue
      const match = r.number.trim().match(pattern)
      if (match) max = Math.max(max, Number(match[1]))
    }
    return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`
  }

  function openForm(t: 'sale' | 'purchase' = 'sale') {
    const effective = fixedType !== 'ALL' ? fixedType : t
    setEditingId(null)
    setType(effective)
    setCustomer('')
    setNumber(nextNumber(effective))
    setDate(new Date().toISOString().slice(0, 10))
    setItems([newItem()])
    setShowForm(true)
    setNotice(null)
    setError(null)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setCustomer('')
    setNumber('')
    setItems([])
    setError(null)
  }

  async function startEdit(row: InvoiceRow) {
    setLoadingEdit(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/v1/invoices/${row.id}`)
      if (!res.ok) throw new Error('Could not load the invoice.')
      const json = await res.json()
      const invoice = json.data?.invoice
      const lines: Array<{ id: string; productId: string | null; description: string; quantity: number; unitPrice: number; vatRate: number }> =
        json.data?.lines ?? []

      setCustomer(json.data?.customer?.name ?? '')
      setType((invoice?.type as 'sale' | 'purchase') ?? 'sale')
      setDate(String(invoice?.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10))
      setNumber(invoice?.number ?? '')
      setItems(
        lines.length > 0
          ? lines.map((l) => ({
              key: `edit-${l.id}`,
              productId: l.productId ?? '',
              description: l.description,
              quantity: String(l.quantity),
              unitPrice: (l.unitPrice / 100).toFixed(2),
              vatRate: String(l.vatRate / 100),
            }))
          : [newItem()],
      )
      setEditingId(row.id)
      setShowForm(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the invoice.')
    } finally {
      setLoadingEdit(false)
    }
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((rows) => rows.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  function addItem() {
    setItems((rows) => [...rows, newItem()])
  }

  function removeItem(key: string) {
    setItems((rows) => (rows.length <= 1 ? rows : rows.filter((i) => i.key !== key)))
  }

  // Line amounts follow the Bangladesh convention: unit price excludes VAT and
  // VAT is added on top, so the invoice total is the VAT-inclusive sum.
  const computed = useMemo(() => {
    let subtotal = 0
    let vat = 0
    const lines = items.map((i) => {
      const qty = Math.max(Math.round(Number(i.quantity)) || 0, 0)
      const unitMinor = toMinor(parseTaka(i.unitPrice))
      const rateBp = Math.round((Number(i.vatRate) || 0) * 100)
      const base = qty * unitMinor
      const vatAmount = Math.round((base * rateBp) / 10000)
      subtotal += base
      vat += vatAmount
      return { productId: i.productId || undefined, description: i.description.trim(), quantity: qty, unitPrice: unitMinor, vatRate: rateBp, base, vatAmount, total: base + vatAmount }
    })
    return { lines, subtotal, vat, total: subtotal + vat }
  }, [items])

  const validLines = computed.lines.filter((l) => l.description && l.quantity > 0)
  const formValid = customer.trim().length > 0 && validLines.length > 0

  const visibleRows = useMemo(() => {
    const base = fixedType === 'ALL' ? rows : rows.filter((r) => r.type === fixedType)
    if (typeFilter === 'ALL') return base
    return base.filter((r) => r.type === typeFilter)
  }, [rows, typeFilter, fixedType])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!formValid) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        customerName: customer.trim(),
        type,
        date,
        number: number.trim() || undefined,
        lines: validLines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
        })),
      }
      const res = await fetch(editingId ? `/api/v1/invoices/${editingId}` : '/api/v1/invoices', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? (editingId ? 'Could not update the invoice.' : 'Could not create the invoice.'))
        return
      }
      const label = number.trim() || (editingId ? 'the invoice' : 'draft')
      setNotice(editingId ? `Saved changes to ${label}.` : `Draft ${label} created. Post it from the list when ready.`)
      setCustomer('')
      setNumber('')
      setItems([])
      setEditingId(null)
      setShowForm(false)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function post() {
    if (!posting) return
    const isPurchase = posting.type === 'purchase'
    if (isPurchase) {
      if (!apAccountId || !expenseAccountId) {
        setError('Choose the payable and expense accounts first.')
        return
      }
    } else {
      if (!arAccountId || !revenueAccountId) {
        setError('Choose the receivable and revenue accounts first.')
        return
      }
    }
    if (posting.vat > 0 && !vatAccountId) {
      setError('Choose the VAT account first.')
      return
    }
    setPostBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/invoices/${posting.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPurchase
          ? { apAccountId, expenseAccountId, vatAccountId: vatAccountId || undefined }
          : { arAccountId, revenueAccountId, vatAccountId: vatAccountId || undefined }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not post the invoice.')
        return
      }
      setNotice(`Posted ${posting.number ?? 'invoice'} as ${json?.data?.sequenceNumber ?? 'a voucher'}.`)
      setPosting(null)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPostBusy(false)
    }
  }

  const title = fixedType === 'sale' ? 'Sales invoices' : fixedType === 'purchase' ? 'Purchase invoices' : 'Tax invoices'
  const description = fixedType === 'sale'
    ? 'Customer invoices with itemised lines and VAT, printable as a Mushak 6.2 document once posted.'
    : fixedType === 'purchase'
    ? 'Supplier bills with itemised lines and VAT, printable as a Mushak 6.2 document once posted.'
    : 'Customer invoices with itemised lines and VAT, printable as a Mushak 6.2 document once posted.'

  const showSaleButton = fixedType === 'ALL' || fixedType === 'sale'
  const showPurchaseButton = fixedType === 'ALL' || fixedType === 'purchase'

  // Parties offered for the current invoice type: suppliers for purchases,
  // customers for sales. Keeps unrelated names out of the autocomplete list.
  const partyOptions = useMemo(() => {
    const wanted = type === 'purchase' ? ['SUPPLIER', 'BOTH'] : ['CUSTOMER', 'BOTH']
    return Object.entries(customers)
      .filter(([id]) => wanted.includes(partyTypes[id]))
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [customers, partyTypes, type])

  return (
    <main className="mx-auto max-w-7xl">
      <datalist id="product-options">
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <datalist id="party-options">
        {partyOptions.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <PageHeader icon={Receipt} title={title} description={description}>
        {showForm ? (
          <Button type="button" variant="outline" onClick={cancelForm}>
            <X size={15} aria-hidden />
            Cancel
          </Button>
        ) : (
          <>
            {showSaleButton && (
              <Button type="button" onClick={() => openForm('sale')}>
                <Plus size={15} aria-hidden />
                New sale invoice
              </Button>
            )}
            {showPurchaseButton && (
              <Button type="button" variant="outline" onClick={() => openForm('purchase')}>
                <Plus size={15} aria-hidden />
                New purchase invoice
              </Button>
            )}
          </>
        )}
      </PageHeader>

      {notice && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <FileText size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {showForm && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit invoice' : type === 'purchase' ? 'New purchase invoice' : 'New sale invoice'}</h2>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
            {fixedType === 'ALL' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Type</label>
                <select value={type} onChange={(e) => { const t = e.target.value as 'sale' | 'purchase'; setType(t); setNumber(nextNumber(t)) }} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25">
                  <option value="sale">Sale (customer invoice)</option>
                  <option value="purchase">Purchase (supplier bill)</option>
                </select>
              </div>
            )}
            <Field
              label={type === 'purchase' ? 'Supplier' : 'Customer'}
              placeholder={type === 'purchase' ? 'Supplier name' : 'Customer name'}
              required
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              list="party-options"
              hint="A new party is created if the name is unknown."
            />
            <Field label="Invoice date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            <Field
              label="Invoice number"
              placeholder="INV-2026-001"
              autoComplete="off"
              optional
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-100 bg-gray-50 px-4 py-2 sm:px-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items</h3>
            <div className="flex items-center gap-2">
              <input
                ref={skuScanRef}
                type="text"
                onKeyDown={onInvoiceSkuScan}
                placeholder="Scan SKU to add item…"
                className="w-44 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <Plus size={13} aria-hidden />
                Add item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Item description</th>
                  <th className="w-20 px-2 py-2 font-medium">Qty</th>
                  <th className="w-32 px-2 py-2 font-medium">Unit price (৳)</th>
                  <th className="w-28 px-2 py-2 font-medium">VAT</th>
                  <th className="w-32 px-2 py-2 text-right font-medium">Amount (৳)</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const line = computed.lines[index]
                  return (
                    <tr key={item.key} className="align-top">
                      <td className="px-4 py-2 sm:px-5">
                        <select
                          aria-label={`Item ${index + 1}`}
                          value={item.productId}
                          onChange={(e) => {
                            const id = e.target.value
                            if (id === '' || id === '__custom__') {
                              updateItem(item.key, { productId: '', description: id === '__custom__' ? item.description : '' })
                              return
                            }
                            const match = products.find((p) => p.id === id)
                            const patch: Partial<Item> = { productId: id, description: match?.name ?? item.description }
                            if (match && match.price > 0) patch.unitPrice = (match.price / 100).toFixed(2)
                            updateItem(item.key, patch)
                          }}
                          className="mb-1.5 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        >
                          <option value="">Select item…</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          <option value="__custom__">Custom description</option>
                        </select>
                        <input
                          aria-label={`Description for item ${index + 1}`}
                          placeholder="Description (optional override)"
                          value={item.description}
                          onChange={(e) => updateItem(item.key, { description: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Quantity for item ${index + 1}`}
                          inputMode="numeric"
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.key, { quantity: e.target.value.replace(/[^\d]/g, '') })}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-right text-sm tabular-nums outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Unit price for item ${index + 1}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.key, { unitPrice: sanitizeAmount(e.target.value) })}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-right text-sm tabular-nums outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          aria-label={`VAT rate for item ${index + 1}`}
                          value={item.vatRate}
                          onChange={(e) => updateItem(item.key, { vatRate: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        >
                          <option value="0">0%</option>
                          {VAT_RATES.filter((r) => r > 0).map((r) => (
                            <option key={r} value={String(r)}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                        <span className="inline-block py-2">{formatTaka(line?.total ?? 0)}</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          disabled={items.length <= 1}
                          aria-label={`Remove item ${index + 1}`}
                          className="rounded p-1.5 text-gray-400 transition hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 border-t border-gray-100 px-4 py-4 sm:grid-cols-2 sm:px-5">
            <p className="self-center text-xs text-gray-500">
              Unit prices exclude VAT; VAT is added on top per line and posted to the VAT payable liability when you post the invoice.
            </p>
            <dl className="space-y-1.5 rounded-lg bg-gray-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Taxable value</dt>
                <dd className="tabular-nums text-gray-700">{formatTaka(computed.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">VAT</dt>
                <dd className="tabular-nums text-gray-700">{formatTaka(computed.vat)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 font-semibold text-gray-900">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatTaka(computed.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-4 sm:px-5">
            <Button type="submit" loading={saving} disabled={!formValid}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create draft'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelForm}>
              Cancel
            </Button>
            <span className="text-xs text-gray-400">Posting happens from the list once the items look right.</span>
          </div>
        </form>
      )}

      {fixedType === 'ALL' && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['ALL', 'sale', 'purchase'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${typeFilter === t ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'ALL' ? 'All' : t === 'sale' ? 'Sales' : 'Purchases'}
            </button>
          ))}
        </div>
      )}

      <DataTable
        columns={[
          { key: 'number', label: 'Number' },
          { key: 'type', label: 'Type' },
          { key: 'date', label: 'Date' },
          { key: 'customer', label: 'Customer' },
          { key: 'items', label: 'Items', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'vat', label: 'VAT', align: 'right' },
          { key: 'outstanding', label: 'Outstanding', align: 'right' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions' },
        ]}
        loading={loading}
        loadingLabel="Loading invoices..."
        isEmpty={visibleRows.length === 0}
        empty={rows.length === 0 ? 'No invoices yet. Create one to start billing.' : 'No invoices match this filter.'}
      >
        {visibleRows.map((row) => (
          <tr key={row.id} className="hover:bg-gray-50/70">
            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-700">
              {row.number ?? row.id.slice(0, 8)}
            </td>
            <td className="px-4 py-2.5">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${row.type === 'purchase' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-blue-50 text-blue-700 ring-blue-200'}`}>
                {row.type}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
              {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
            <td className="px-4 py-2.5 text-gray-900">
              {(row.customerId && customers[row.customerId]) ?? <span className="text-gray-400">—</span>}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
              {row.lineCount > 0 ? row.lineCount : <span className="text-gray-300">0</span>}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatTaka(row.total)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatTaka(row.vat)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {row.status === 'cancelled' || row.status === 'draft' ? (
                <span className="text-gray-300">—</span>
              ) : row.total - row.paid > 0 ? (
                <span className="text-amber-700">{formatTaka(row.total - row.paid)}</span>
              ) : (
                <span className="text-emerald-700">Settled</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_BADGE[row.status]}`}
              >
                {row.status}
              </span>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5">
              <div className="flex items-center gap-3">
                {row.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    disabled={loadingEdit}
                    className="text-xs font-semibold text-gray-600 hover:underline disabled:opacity-50"
                  >
                    {loadingEdit && editingId === row.id ? 'Loading...' : 'Edit'}
                  </button>
                )}
                {row.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPosting(row)
                      setNotice(null)
                      setError(null)
                    }}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Post
                  </button>
                )}
                {(row.status === 'sent' || row.status === 'partially_paid') && (
                  <button
                    type="button"
                    onClick={() =>
                      setSettling({ id: row.id, number: row.number, type: row.type, total: row.total, paid: row.paid, status: row.status })
                    }
                    className="text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    {row.type === 'sale' ? 'Receive' : 'Pay'}
                  </button>
                )}
                <a
                  href={`/api/v1/invoices/${row.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
                >
                  PDF
                </a>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {posting && (
        <Modal
          title={`Post invoice ${posting.number ?? posting.id.slice(0, 8)}`}
          subtitle={`${formatTaka(posting.total)} total · ${formatTaka(posting.vat)} VAT · posts a ${posting.type === 'purchase' ? 'purchase' : 'sales'} voucher and locks the invoice.`}
          size="lg"
          onClose={() => setPosting(null)}
          footer={
            <>
              <Button
                type="button"
                onClick={post}
                loading={postBusy}
                disabled={(posting.type === 'purchase' ? (!apAccountId || !expenseAccountId) : (!arAccountId || !revenueAccountId)) || (posting.vat > 0 && !vatAccountId)}
              >
                {postBusy ? 'Posting...' : 'Post invoice'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setPosting(null)}>
                Cancel
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {posting.type === 'purchase' ? (
              <>
                <div>
                  <label htmlFor="ap-account" className="mb-1.5 block text-sm font-medium text-gray-700">Payable account (AP)</label>
                  <select id="ap-account" className={controlClass} value={apAccountId} onChange={(e) => setApAccountId(e.target.value)}>
                    <option value="">Select liability account</option>
                    {vatAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="expense-account" className="mb-1.5 block text-sm font-medium text-gray-700">Expense account</label>
                  <select id="expense-account" className={controlClass} value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)}>
                    <option value="">Select expense account</option>
                    {accounts.filter((a) => !a.isGroup && a.type === 'EXPENSE').map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="ar-account" className="mb-1.5 block text-sm font-medium text-gray-700">Receivable account</label>
                  <select id="ar-account" className={controlClass} value={arAccountId} onChange={(e) => setArAccountId(e.target.value)}>
                    <option value="">Select asset account</option>
                    {arAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </select>
                </div>
                <div>
                  <label htmlFor="revenue-account" className="mb-1.5 block text-sm font-medium text-gray-700">Revenue account</label>
                  <select id="revenue-account" className={controlClass} value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)}>
                    <option value="">Select revenue account</option>
                    {revenueAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label htmlFor="vat-account" className="mb-1.5 block text-sm font-medium text-gray-700">VAT account</label>
              <select id="vat-account" className={controlClass} value={vatAccountId} onChange={(e) => setVatAccountId(e.target.value)}>
                <option value="">Select VAT account</option>
                {vatAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name}</option>))}
              </select>
            </div>
            <p className="text-xs text-gray-400">
              {posting.vat > 0 ? `VAT of ${formatTaka(posting.vat)} is ${posting.type === 'purchase' ? 'debited to VAT input' : 'credited to VAT payable'}.` : 'This invoice carries no VAT.'}
            </p>
          </div>
        </Modal>
      )}

      {settling && (
        <InvoiceSettlement
          invoice={settling}
          accounts={accounts}
          onClose={() => setSettling(null)}
          onChanged={load}
        />
      )}
    </main>
  )
}