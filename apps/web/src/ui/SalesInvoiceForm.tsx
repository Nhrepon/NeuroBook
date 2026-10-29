'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Scale, Send } from 'lucide-react'
import {
  INVOICE_ACCOUNTS, accountByCode, can, formatTaka, voucherTypePermission,
  type Role,
} from '@neurobook/shared'
import { buildInvoiceEntries } from '@/lib/invoice-ui'
import AccountPicker, { type LedgerAccount } from '@/ui/AccountPicker'
import Field, { FormAlert } from '@/ui/Field'
import InvoiceItemsEditor, {
  computeInvoiceItems, newInvoiceItem, validInvoiceLines, type InvoiceItem,
} from '@/ui/InvoiceItems'

const TYPE = 'SALES_INVOICE'

/**
 * Dedicated sales-invoice entry screen. The user gives the customer, the
 * invoice number and the amounts; the receivable / income / VAT double entry is
 * generated so a credit sale can never be posted out of balance.
 */
export default function SalesInvoiceForm() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [role, setRole] = useState<Role | null>(null)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [customer, setCustomer] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [narration, setNarration] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>(() => [newInvoiceItem()])

  const [receivableId, setReceivableId] = useState('')
  const [incomeId, setIncomeId] = useState('')
  const [vatId, setVatId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'draft' | 'post' | null>(null)
  const [done, setDone] = useState<{ kind: 'draft' | 'posted'; id: string; sequenceNumber?: string } | null>(null)

  useEffect(() => {
    fetch('/api/v1/accounts')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('accounts'))))
      .then((j) => setAccounts(j.data ?? []))
      .catch(() => setError('Could not load the chart of accounts.'))

    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  // Prefill the mapping from the standard chart; a stale pick is never overwritten.
  useEffect(() => {
    if (accounts.length === 0) return
    const pick = (code: string) => accountByCode(accounts, code)?.id ?? ''
    setReceivableId((cur) => cur || pick(INVOICE_ACCOUNTS.sales.party))
    setIncomeId((cur) => cur || pick(INVOICE_ACCOUNTS.sales.income))
    setVatId((cur) => cur || pick(INVOICE_ACCOUNTS.sales.tax))
  }, [accounts])

  const canWrite = role ? can(role, voucherTypePermission(TYPE)) : true

  const computed = useMemo(() => computeInvoiceItems(items), [items])
  const lines = useMemo(() => validInvoiceLines(items, computed.lines), [items, computed])
  const totalMinor = computed.total
  const vatMinor = computed.vat
  const netMinor = computed.subtotal

  const entries = useMemo(
    () =>
      buildInvoiceEntries(
        'sales',
        { totalMinor, vatMinor, netMinor },
        { party: receivableId, income: incomeId, tax: vatId },
        invoiceNo.trim() || undefined,
      ),
    [totalMinor, vatMinor, netMinor, receivableId, incomeId, vatId, invoiceNo],
  )

  const totals = entries.reduce((acc, e) => ({ debit: acc.debit + e.debit, credit: acc.credit + e.credit }), { debit: 0, credit: 0 })
  const balanced = totals.debit === totals.credit && totals.debit > 0
  const effectiveNarration =
    narration.trim() || (customer.trim() ? `Credit sale to ${customer.trim()}${invoiceNo.trim() ? ` (${invoiceNo.trim()})` : ''}` : '')

  const problems = useMemo(() => {
    const list: string[] = []
    if (!canWrite) list.push('Your role cannot raise sales invoices.')
    if (!date) list.push('Pick the invoice date.')
    if (!customer.trim()) list.push('Enter the customer name.')
    if (!effectiveNarration) list.push('Add a narration or a customer name so the entry is self-explanatory.')
    if (lines.length === 0) list.push('Add at least one item with a description and a quantity.')
    if (totalMinor <= 0) list.push('Item lines must add up to an invoice total.')
    if (vatMinor > totalMinor) list.push('VAT cannot exceed the invoice total.')
    if (!receivableId) list.push('Choose the receivable account.')
    if (!incomeId) list.push('Choose the income account.')
    if (vatMinor > 0 && !vatId) list.push('Choose the VAT payable account.')
    return list
  }, [canWrite, date, customer, effectiveNarration, lines.length, totalMinor, vatMinor, receivableId, incomeId, vatId])

  async function save(action: 'draft' | 'post') {
    setError(null)
    if (problems.length > 0) {
      setError(problems[0])
      return
    }

    setBusy(action)
    try {
      const created = await fetch('/api/v1/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, narration: effectiveNarration, voucherType: TYPE }),
      })
      if (!created.ok) {
        const body = await created.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not create the invoice.')
        return
      }
      const id = (await created.json()).data?.id
      if (!id) {
        setError('Could not create the invoice.')
        return
      }

      if (action === 'post') {
        const posted = await fetch(`/api/v1/vouchers/${id}/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            narration: effectiveNarration,
            voucherType: TYPE,
            entries,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        if (!posted.ok) {
          const body = await posted.json().catch(() => null)
          setError(`${body?.error?.message ?? 'Could not post the invoice.'} It was kept as a draft.`)
          return
        }
        const body = await posted.json()
        setDone({ kind: 'posted', id, sequenceNumber: body.data?.sequenceNumber })
        return
      }

      const saved = await fetch(`/api/v1/vouchers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, narration: effectiveNarration, entries }),
      })
      if (!saved.ok) {
        const body = await saved.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not save the draft.')
        return
      }
      setDone({ kind: 'draft', id })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" aria-hidden />
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            {done.kind === 'posted' ? 'Sales invoice posted' : 'Draft saved'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {done.kind === 'posted'
              ? 'Numbered for this fiscal year and locked against edits.'
              : 'Keep editing it until it is posted.'}
          </p>
          {done.sequenceNumber && (
            <p className="mt-3 inline-block rounded-lg bg-gray-50 px-3 py-1.5 font-mono text-sm text-gray-700">
              {done.sequenceNumber}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/dashboard/vouchers/${done.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              View voucher
            </Link>
            <Link
              href="/dashboard/sales"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back to sales
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const disabled = busy !== null

  return (
    <main className="mx-auto max-w-7xl">
      <header className="mb-5">
        <Link href="/dashboard/sales" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-700">
          <ArrowLeft size={13} aria-hidden />
          Sales
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">New sales invoice</h1>
        <p className="mt-1 text-sm text-gray-500">
          Credit sale raised on invoice. Receivables are debited; income and VAT payable are credited.
        </p>
      </header>

      {!canWrite && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view sales invoices but not raise them. Ask an admin for the Sales or Accountant role.
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Invoice details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Customer"
              required
              placeholder="Rahim Traders"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <Field label="Invoice date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            <Field
              label="Invoice number"
              optional
              placeholder="INV-2026-001"
              autoComplete="off"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
            <Field
              label="Narration"
              optional
              placeholder="auto from customer"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>
        </section>

        <InvoiceItemsEditor items={items} onChange={setItems} disabled={disabled} />

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Ledger mapping</h2>
          <p className="mt-0.5 text-xs text-gray-500">Defaults from the standard chart; change them if this company posts elsewhere.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Receivable account</span>
              <AccountPicker
                accounts={accounts}
                value={receivableId}
                disabled={disabled}
                onChange={(a) => setReceivableId(a?.id ?? '')}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Income account</span>
              <AccountPicker
                accounts={accounts}
                value={incomeId}
                disabled={disabled}
                onChange={(a) => setIncomeId(a?.id ?? '')}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">VAT payable account</span>
              <AccountPicker
                accounts={accounts}
                value={vatId}
                disabled={disabled}
                onChange={(a) => setVatId(a?.id ?? '')}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-gray-900">Generated entry</h2>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Scale size={13} aria-hidden />
              {balanced ? <span className="font-medium text-emerald-600">Balanced</span> : <span className="text-gray-400">Waiting for amounts</span>}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Ledger account</th>
                  <th className="w-32 px-4 py-2 text-right font-medium">Debit (৳)</th>
                  <th className="w-32 px-4 py-2 text-right font-medium">Credit (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      Enter the amounts to see the double entry.
                    </td>
                  </tr>
                )}
                {entries.map((e, i) => {
                  const account = accounts.find((a) => a.id === e.accountId)
                  return (
                    <tr key={`${e.accountId}-${i}`}>
                      <td className="px-4 py-2 text-gray-900">
                        {account ? (
                          <span>
                            <span className="font-mono text-xs text-gray-400">{account.code}</span> {account.name}
                          </span>
                        ) : (
                          <span className="text-red-500">Pick a ledger account</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{e.debit ? formatTaka(e.debit) : ''}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{e.credit ? formatTaka(e.credit) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-4 py-2.5 text-xs text-gray-500">Totals</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.debit)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {error && <FormAlert message={error} />}

        {problems.length > 0 && !error && (
          <ul className="space-y-1 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
            {problems.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => save('post')}
            disabled={disabled || problems.length > 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'post' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
            {busy === 'post' ? 'Posting...' : 'Save & post'}
          </button>
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={disabled || problems.length > 0}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'draft' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
            {busy === 'draft' ? 'Saving...' : 'Save as draft'}
          </button>
          <span className="ml-auto hidden text-xs text-gray-400 sm:block">Numbering is applied when you post.</span>
        </div>
      </form>
    </main>
  )
}
