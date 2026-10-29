'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Boxes, History, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { can, formatTaka, type Role } from '@neurobook/shared'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import RoleNotice from '@/ui/RoleNotice'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import StockList, { KIND_META, formatDate, type StockRow, type StockDetail } from './StockList'

export default function StockPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [adjusting, setAdjusting] = useState<StockRow | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState<StockDetail | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/stock', { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load stock')
      const json = await res.json()
      setRows(json.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load stock')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [load])

  const canWrite = role ? can(role, 'stock:write') : true

  function openAdjust(row: StockRow) {
    setAdjusting(row)
    setQty('')
    setReason('')
    setError(null)
    setNotice(null)
  }

  async function openDetail(row: StockRow) {
    setDetailId(row.id)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/v1/stock/${row.id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load item history')
      const json = await res.json()
      setDetail(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load item history')
      setDetailId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjusting) return
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity === 0) {
      setError('Enter a non-zero quantity.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: adjusting.id, quantity, reason: reason.trim() || undefined }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error?.message ?? 'Could not adjust stock.')
        return
      }
      setNotice(`${quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(quantity)} ${adjusting.unit ?? 'unit(s)'} of ${adjusting.name}.`)
      setAdjusting(null)
      await load()
      if (detailId === adjusting.id) await openDetail(adjusting)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl">
      <PageHeader
        icon={Boxes}
        title="Stock"
        description="On-hand quantity per product with purchases, sales and adjustments. Purchases add stock, sales remove it."
      />

      {role && !canWrite && <RoleNotice>Your role can view stock but not adjust it.</RoleNotice>}

      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</p>
      )}
      {error && !adjusting && <FormAlert message={error} />}

      <StockList rows={rows} loading={loading} canWrite={canWrite} onDetail={openDetail} onAdjust={openAdjust} />

      {adjusting && (
        <Modal
          title="Adjust stock"
          subtitle={`${adjusting.name} · currently ${adjusting.onHand} ${adjusting.unit ?? 'unit(s)'} on hand`}
          size="md"
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <Button type="submit" form="adjust-form" loading={saving} disabled={qty.trim() === '' || qty === '-'}>
                {saving ? 'Saving...' : 'Save adjustment'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAdjusting(null)}>
                Cancel
              </Button>
            </>
          }
        >
          <form id="adjust-form" onSubmit={submitAdjust} className="space-y-4">
            <div>
              <label htmlFor="adjust-qty" className="mb-1.5 block text-sm font-medium text-gray-700">
                Quantity
              </label>
              <input
                id="adjust-qty"
                autoFocus
                inputMode="decimal"
                placeholder="e.g. 10 or -3.5"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d.-]/g, ''))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
              <p className="mt-1 text-xs text-gray-400">Positive adds stock, negative removes it.</p>
            </div>

            <div>
              <label htmlFor="adjust-reason" className="mb-1.5 block text-sm font-medium text-gray-700">
                Reason <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="adjust-reason"
                placeholder="Opening balance, stock count, damage..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>

            {error && <FormAlert message={error} />}
          </form>
        </Modal>
      )}

      {detailId && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={() => setDetailId(null)}>
          <aside
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-5 py-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                  <History size={13} aria-hidden />
                  Stock item
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-gray-900">{detail?.product.name ?? 'Loading...'}</h2>
              </div>
              <button type="button" onClick={() => setDetailId(null)} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={18} aria-hidden />
              </button>
            </header>

            {detailLoading || !detail ? (
              <div className="flex flex-1 items-center justify-center text-gray-500">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Loading history...
                </span>
              </div>
            ) : (
              <div className="px-5 py-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-gray-600">
                    {detail.product.skus.length > 0 ? detail.product.skus.join(', ') : 'no SKU'}
                  </span>
                  {detail.product.category && (
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-600">{detail.product.category}</span>
                  )}
                  {detail.product.unit && (
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-600">per {detail.product.unit}</span>
                  )}
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-600">price {formatTaka(detail.product.price)}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: 'Purchased', value: detail.totals.purchased, className: 'text-emerald-700' },
                    { label: 'Sold', value: detail.totals.sold, className: 'text-blue-700' },
                    { label: 'Adjusted', value: detail.totals.adjusted, className: 'text-amber-700' },
                    { label: 'On hand', value: detail.totals.onHand, className: 'text-gray-900' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{s.label}</p>
                      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${s.className}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  On-hand value {formatTaka(detail.totals.stockValue)}
                </p>

                <h3 className="mt-5 mb-2 text-sm font-semibold text-gray-900">Movement history</h3>
                {detail.movements.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                    No stock movements yet.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 text-right font-medium">Qty</th>
                          <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.movements.map((m) => (
                          <tr key={m.id}>
                            <td className="px-3 py-2 text-xs text-gray-500">{formatDate(m.date)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${KIND_META[m.kind].className}`}>
                                {m.kind === 'in' && <ArrowDownRight size={11} aria-hidden />}
                                {m.kind === 'out' && <ArrowUpRight size={11} aria-hidden />}
                                {m.kind === 'transfer' && <ArrowUpRight size={11} aria-hidden />}
                                {m.kind === 'adjustment' && <SlidersHorizontal size={11} aria-hidden />}
                                {KIND_META[m.kind].label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {m.warehouse || m.toWarehouse
                                ? `${m.warehouse ?? '—'}${m.toWarehouse ? ` → ${m.toWarehouse}` : ''}`
                                : m.reference
                                  ? `#${m.reference}`
                                  : m.description || '—'}
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums ${m.quantity > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {m.unitCost ? formatTaka(m.unitCost) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}
