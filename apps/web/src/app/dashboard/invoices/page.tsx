'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Plus, Receipt, Trash2, X } from 'lucide-react'
import { VAT_RATES, formatTaka, toMinor } from '@neurobook/shared'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'
import Field, { FormAlert } from '@/ui/Field'
import type { LedgerAccount } from '@/ui/AccountPicker'

interface InvoiceRow {
  id: string
  customerId: string | null
  number: string | null
  date: string
  total: number
  vat: number
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  lineCount: number
}

interface Product {
  id: string
  name: string
  unit: string | null
}

interface Item {
  key: string
  productId: string
  description: string
  quantity: string
  unitPrice: string
  vatRate: string // percent
}

const STATUS_BADGE: Record<InvoiceRow['status'], string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  sent: 'bg-blue-50 text-blue-700 ring-blue-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-300',
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [customers, setCustomers] = useState<Record<string, string>>({})
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [customer, setCustomer] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [number, setNumber] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)

  const [posting, setPosting] = useState<InvoiceRow | null>(null)
  const [arAccountId, setArAccountId] = useState('')
  const [revenueAccountId, setRevenueAccountId] = useState('')
  const [vatAccountId, setVatAccountId] = useState('')
  const [postBusy, setPostBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const seq = useRef(0)
  function newItem(): Item {
    seq.current += 1
    return { key: `i${Date.now()}-${seq.current}`, productId: '', description: '', quantity: '1', unitPrice: '', vatRate: '15' }
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
        for (const p of j?.data ?? []) map[p.id] = p.name
        setCustomers(map)
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
      })
      .catch(() => {})
  }, [])

  function openForm() {
    setEditingId(null)
    setCustomer('')
    setNumber('')
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

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!formValid) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        customerName: customer.trim(),
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
      setNotice(editingId ? `Saved changes to ${number.trim() || 'the invoice'}.` : null)
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
    if (!arAccountId || !revenueAccountId) {
      setError('Choose the receivable and revenue accounts first.')
      return
    }
    if (posting.vat > 0 && !vatAccountId) {
      setError('Choose the VAT payable account first.')
      return
    }
    setPostBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/invoices/${posting.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arAccountId, revenueAccountId, vatAccountId: vatAccountId || undefined }),
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

  return (
    <main className="mx-auto max-w-5xl">
      <datalist id="product-options">
        {products.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Receipt size={22} className="text-blue-600" aria-hidden />
            Tax invoices
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Customer invoices with itemised lines and VAT, printable as a Mushak 6.2 document once posted.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (showForm ? cancelForm() : openForm())}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {showForm ? <X size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
          {showForm ? 'Cancel' : 'New invoice'}
        </button>
      </header>

      {notice && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <FileText size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      {showForm && (
        <form onSubmit={create} className="mb-5 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-gray-900">{editingId ? 'Edit invoice' : 'New invoice'}</h2>
          </div>

          <div className="grid gap-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
            <Field
              label="Customer"
              placeholder="Rahim Traders"
              required
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              hint="A new customer record is created if the name is unknown."
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

          <div className="flex items-center justify-between border-y border-gray-100 bg-gray-50 px-4 py-2 sm:px-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Plus size={13} aria-hidden />
              Add item
            </button>
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
                        <input
                          aria-label={`Description for item ${index + 1}`}
                          list="product-options"
                          placeholder="e.g. A4 paper ream"
                          value={item.description}
                          onChange={(e) => {
                            const value = e.target.value
                            const match = products.find((p) => p.name.toLowerCase() === value.trim().toLowerCase())
                            updateItem(item.key, { description: value, productId: match?.id ?? '' })
                          }}
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
            <button
              type="submit"
              disabled={!formValid || saving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create draft'}
            </button>
            <span className="text-xs text-gray-400">Posting happens from the list once the items look right.</span>
          </div>
        </form>
      )}

      {error && <FormAlert message={error} />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Items</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">VAT</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Loading invoices...
                    </span>
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No invoices yet. Create one to start billing customers.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/70">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-700">
                      {row.number ?? row.id.slice(0, 8)}
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
                            {loadingEdit && editingId === row.id ? 'Loading…' : 'Edit'}
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
            </tbody>
          </table>
        </div>
      </div>

      {posting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Post invoice {posting.number ?? posting.id.slice(0, 8)}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {formatTaka(posting.total)} total · {formatTaka(posting.vat)} VAT · posts a sales voucher and locks the invoice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPosting(null)}
                aria-label="Close"
                className="rounded p-1 text-gray-400 transition hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ar-account" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Receivable account
                </label>
                <select id="ar-account" className={controlClass} value={arAccountId} onChange={(e) => setArAccountId(e.target.value)}>
                  <option value="">Select asset account</option>
                  {arAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="revenue-account" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Revenue account
                </label>
                <select id="revenue-account" className={controlClass} value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)}>
                  <option value="">Select revenue account</option>
                  {revenueAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vat-account" className="mb-1.5 block text-sm font-medium text-gray-700">
                  VAT payable account
                </label>
                <select id="vat-account" className={controlClass} value={vatAccountId} onChange={(e) => setVatAccountId(e.target.value)}>
                  <option value="">Select VAT payable account</option>
                  {vatAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-400">
                {posting.vat > 0
                  ? `VAT of ${formatTaka(posting.vat)} is credited to the selected VAT payable account.`
                  : 'This invoice carries no VAT, so no VAT line is posted.'}
                {posting.vat > 0 && !vatAccountId && ' Choose a VAT payable account first.'}
              </p>
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={post}
                disabled={postBusy || !arAccountId || !revenueAccountId || (posting.vat > 0 && !vatAccountId)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {postBusy && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {postBusy ? 'Posting...' : 'Post invoice'}
              </button>
              <button
                type="button"
                onClick={() => setPosting(null)}
                className="text-sm font-medium text-gray-500 transition hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
