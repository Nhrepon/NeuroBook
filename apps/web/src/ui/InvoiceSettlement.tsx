'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { formatTaka, toMinor } from '@neurobook/shared'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'
import Field, { FormAlert } from '@/ui/Field'
import Modal from '@/ui/Modal'
import Button from '@/ui/Button'
import type { LedgerAccount } from '@/ui/AccountPicker'

export interface SettleTarget {
  id: string
  number: string | null
  type: 'sale' | 'purchase'
  total: number
  paid: number
  status: string
}

interface PaymentRow {
  id: string
  amount: number
  direction: 'in' | 'out'
  method: string
  reference: string | null
  paidAt: string
}

const METHODS = ['cash', 'bank', 'mobile', 'cheque', 'card', 'transfer', 'other'] as const

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

/**
 * Records money received against a sale invoice (a receipt) or paid against a
 * purchase invoice (a payment). Each settlement posts the matching voucher, so
 * the ledger, the bank register and the invoice status move together.
 */
export default function InvoiceSettlement({
  invoice,
  accounts,
  onClose,
  onChanged,
}: {
  invoice: SettleTarget
  accounts: LedgerAccount[]
  onClose: () => void
  onChanged: () => void
}) {
  const isReceipt = invoice.type === 'sale'
  const [paid, setPaid] = useState(invoice.paid)
  const outstanding = Math.max(invoice.total - paid, 0)

  const assetAccounts = useMemo(() => accounts.filter((a) => !a.isGroup && a.type === 'ASSET'), [accounts])

  const [amount, setAmount] = useState(() => (outstanding / 100).toFixed(2))
  const [accountId, setAccountId] = useState('')
  const [method, setMethod] = useState<string>('cash')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const preferred = assetAccounts.find((a) => a.code === '1100') ?? assetAccounts.find((a) => a.code === '1120') ?? assetAccounts[0]
    if (preferred) setAccountId((current) => current || preferred.id)
  }, [assetAccounts])

  async function loadPayments() {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/payments?invoiceId=${encodeURIComponent(invoice.id)}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const list: PaymentRow[] = json.data ?? []
        setRows(list)
        setPaid(list.reduce((sum, p) => sum + p.amount, 0))
      }
    } catch {
      // The list is secondary; recording still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id])

  const amountMinor = toMinor(parseTaka(amount))
  const valid = amountMinor > 0 && amountMinor <= outstanding && accountId !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          amount: amountMinor,
          accountId,
          method,
          date,
          reference: reference.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not record the payment.')
        return
      }
      setReference('')
      await loadPayments()
      onChanged()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Undo this payment? Its voucher is reversed and the invoice status recalculated.')) return
    setError(null)
    try {
      const res = await fetch(`/api/v1/payments/${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not undo the payment.')
        return
      }
      await loadPayments()
      onChanged()
    } catch {
      setError('Network error. Please try again.')
    }
  }

  const dateFmt = (v: string) => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <Modal
      title={`${isReceipt ? 'Receive payment' : 'Pay supplier'} · ${invoice.number ?? invoice.id.slice(0, 8)}`}
      subtitle={isReceipt ? 'Money received against a sales invoice.' : 'Money paid against a purchase bill.'}
      size="xl"
      onClose={onClose}
      footer={
        <>
          <Button type="submit" form="settle-form" loading={busy} disabled={!valid}>
            {busy ? 'Saving...' : isReceipt ? 'Record receipt' : 'Record payment'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Total</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">{formatTaka(invoice.total)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Paid</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-700">{formatTaka(invoice.paid)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Outstanding</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-700">{formatTaka(outstanding)}</p>
        </div>
      </div>

      {outstanding <= 0 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          This invoice is fully paid.
        </p>
      ) : (
        <form id="settle-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Amount (৳)"
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
            hint={amountMinor > outstanding ? `More than the ${formatTaka(outstanding)} outstanding.` : undefined}
          />
          <div>
            <label htmlFor="settle-account" className="mb-1.5 block text-sm font-medium text-gray-700">
              {isReceipt ? 'Received into' : 'Paid from'}
            </label>
            <select
              id="settle-account"
              className={controlClass}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select cash / bank</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settle-method" className="mb-1.5 block text-sm font-medium text-gray-700">
              Method
            </label>
            <select id="settle-method" className={controlClass} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <Field label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Field
            label="Reference"
            optional
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Cheque / transaction no."
            className="sm:col-span-2"
          />
        </form>
      )}

      {error && <div className="mt-3"><FormAlert message={error} /></div>}

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payments</h3>
        {loading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Loading...
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nothing recorded against this invoice yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums text-gray-900">
                    {formatTaka(p.amount)}
                    <span className="ml-2 text-xs font-normal capitalize text-gray-500">{p.method}</span>
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {dateFmt(p.paidAt)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                >
                  <Trash2 size={12} aria-hidden />
                  Undo
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
