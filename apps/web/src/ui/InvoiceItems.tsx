'use client'

import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { VAT_RATES, formatTaka, toMinor } from '@neurobook/shared'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'
import Button from '@/ui/Button'

export interface InvoiceItem {
  key: string
  description: string
  quantity: string
  unitPrice: string
  /** VAT rate as a percentage string; the API stores it in basis points. */
  vatRate: string
}

export interface ComputedLine {
  description: string
  quantity: number
  /** Minor units, excluding VAT. */
  unitPrice: number
  /** Basis points (1500 = 15%). */
  vatRate: number
  vatAmount: number
  total: number
}

let seq = 0

export function newInvoiceItem(vatRate = '15'): InvoiceItem {
  seq += 1
  return { key: `item-${seq}`, description: '', quantity: '1', unitPrice: '', vatRate }
}

const money =
  'w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:bg-gray-50 disabled:text-gray-400'

/**
 * Item lines for an invoice. Unit prices exclude VAT; VAT is added on top per
 * line, so the invoice total is the VAT-inclusive sum of the lines.
 */
export function computeInvoiceItems(items: InvoiceItem[]): {
  lines: ComputedLine[]
  subtotal: number
  vat: number
  total: number
} {
  let subtotal = 0
  let vat = 0
  const lines = items.map((i) => {
    const quantity = Math.max(Math.round(Number(i.quantity)) || 0, 0)
    const unitPrice = toMinor(parseTaka(i.unitPrice))
    const vatRate = Math.round((Number(i.vatRate) || 0) * 100)
    const base = quantity * unitPrice
    const vatAmount = Math.round((base * vatRate) / 10000)
    subtotal += base
    vat += vatAmount
    return { description: i.description.trim(), quantity, unitPrice, vatRate, vatAmount, total: base + vatAmount }
  })
  return { lines, subtotal, vat, total: subtotal + vat }
}

/** Only lines with a description and a positive quantity can be saved. */
export function validInvoiceLines(items: InvoiceItem[], lines: ComputedLine[]): ComputedLine[] {
  return lines.filter((l, i) => l.description.length > 0 && l.quantity > 0 && items[i] !== undefined)
}

interface Props {
  items: InvoiceItem[]
  onChange: (items: InvoiceItem[]) => void
  disabled?: boolean
}

export default function InvoiceItemsEditor({ items, onChange, disabled }: Props) {
  const computed = useMemo(() => computeInvoiceItems(items), [items])

  function update(key: string, patch: Partial<InvoiceItem>) {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  function remove(key: string) {
    if (items.length <= 1) return
    onChange(items.filter((i) => i.key !== key))
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Items</h2>
          <p className="mt-0.5 text-xs text-gray-500">Unit prices exclude VAT; VAT is added on top per line.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, newInvoiceItem(items[items.length - 1]?.vatRate ?? '15')])}
          disabled={disabled}
        >
          <Plus size={13} aria-hidden />
          Add item
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium sm:px-5">Description</th>
              <th className="w-20 px-2 py-2 font-medium">Qty</th>
              <th className="w-32 px-2 py-2 font-medium">Unit price (৳)</th>
              <th className="w-24 px-2 py-2 font-medium">VAT</th>
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
                      placeholder="e.g. A4 paper ream"
                      value={item.description}
                      disabled={disabled}
                      onChange={(e) => update(item.key, { description: e.target.value })}
                      className={money}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Quantity for item ${index + 1}`}
                      inputMode="numeric"
                      placeholder="1"
                      value={item.quantity}
                      disabled={disabled}
                      onChange={(e) => update(item.key, { quantity: e.target.value.replace(/[^\d]/g, '') })}
                      className={`${money} text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      aria-label={`Unit price for item ${index + 1}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={item.unitPrice}
                      disabled={disabled}
                      onChange={(e) => update(item.key, { unitPrice: sanitizeAmount(e.target.value) })}
                      className={`${money} text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      aria-label={`VAT rate for item ${index + 1}`}
                      value={item.vatRate}
                      disabled={disabled}
                      onChange={(e) => update(item.key, { vatRate: e.target.value })}
                      className={`${money} bg-white`}
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
                      onClick={() => remove(item.key)}
                      disabled={disabled || items.length <= 1}
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

      <dl className="ml-auto flex max-w-xs flex-col gap-1.5 border-t border-gray-100 px-4 py-3 text-sm sm:px-5">
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
    </section>
  )
}