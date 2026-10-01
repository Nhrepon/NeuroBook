'use client'

import { useActionState, useState } from 'react'
import { createInvoiceAction } from '@/actions/invoice.actions'
import { Button } from './Button'

// Client-safe shape of an account (don't import from the repo layer,
// which is server-only — it drags drizzle/postgres into the client bundle).
interface AccountLite {
  id: string
  code: string
  name: string
}

interface Line {
  description: string
  quantity: string
  unitPrice: string
  vatRate: string
  sdRate: string
}

function newLine(): Line {
  return { description: '', quantity: '1', unitPrice: '0', vatRate: '15', sdRate: '0' }
}

export function InvoiceForm({ accounts }: { accounts: AccountLite[] }) {
  const [state, action, pending] = useActionState(createInvoiceAction, { ok: false })
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([newLine()])

  function patchLine(i: number, p: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)))
  }

  const payload = JSON.stringify({
    customerId,
    date,
    lines: lines.map((l) => ({
      productId: l.description || 'item',
      description: l.description,
      quantity: Number(l.quantity || 0),
      unitPrice: Number(l.unitPrice || 0),
      vatRate: Number(l.vatRate || 0),
      sdRate: Number(l.sdRate || 0),
    })),
  })

  const acctName = (id: string) => accounts.find((a) => a.id === id)?.code ?? id

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block">Customer</span>
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            placeholder="Customer id"
            className="w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded border px-2 py-1.5"
          />
        </label>
      </div>

      <h3 className="text-sm font-semibold">Line items</h3>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-6 gap-2">
          <input
            placeholder="Description"
            value={l.description}
            onChange={(e) => patchLine(i, { description: e.target.value })}
            className="col-span-2 rounded border px-2 py-1"
          />
          <input
            type="number"
            min={0}
            placeholder="Qty"
            value={l.quantity}
            onChange={(e) => patchLine(i, { quantity: e.target.value })}
            className="rounded border px-2 py-1"
          />
          <input
            type="number"
            min={0}
            placeholder="Rate ৳"
            value={l.unitPrice}
            onChange={(e) => patchLine(i, { unitPrice: e.target.value })}
            className="rounded border px-2 py-1"
          />
          <input
            type="number"
            min={0}
            max={100}
            placeholder="VAT%"
            value={l.vatRate}
            onChange={(e) => patchLine(i, { vatRate: e.target.value })}
            className="rounded border px-2 py-1"
          />
          <button
            type="button"
            onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
            className="rounded border px-2 text-xs hover:bg-[hsl(var(--accent))]"
          >
            −
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => setLines((p) => [...p, newLine()])}>
        + Add line
      </Button>

      <input type="hidden" name="payload" value={payload} />
      <input type="hidden" name="customerId" value={customerId} />

      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600" role="status">Invoice created. Opening in a new tab: /invoices</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? 'Creating…' : 'Create invoice (Ctrl+Enter)'}
        </Button>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          Accounts available: {accounts.length} · Sundry Debtors: {acctName('sundry-debtors')}
        </span>
      </div>
    </form>
  )
}
