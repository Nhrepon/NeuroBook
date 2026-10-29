'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Save, Send } from 'lucide-react'
import { can, formatTaka, toMinor, type Role } from '@neurobook/shared'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'
import AccountPicker, { type LedgerAccount } from '@/ui/AccountPicker'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'

type Direction = 'in' | 'out'
type Method = 'cash' | 'bank' | 'mobile' | 'cheque' | 'card' | 'transfer' | 'other'

const METHODS: Method[] = ['cash', 'bank', 'mobile', 'cheque', 'card', 'transfer', 'other']

interface MoneyFormProps {
  direction: Direction
  /** Where "Back" and the success screen return to. */
  listHref: string
}

interface BillOption {
  id: string
  number: string | null
  type: 'sale' | 'purchase'
  date: string
  total: number
  paid: number
  customerId: string | null
  status: string
}

interface PartyOption {
  id: string
  name: string
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH'
}

function minor(value: string) {
  return toMinor(parseTaka(value))
}

/**
 * A focused receipt/payment entry. Instead of a free-form journal it asks the two
 * questions that matter — which cash/bank account moved, and who it moved to or
 * from — then builds the balanced two-line voucher and posts it.
 */
export default function MoneyForm({ direction, listHref }: MoneyFormProps) {
  const isReceipt = direction === 'in'
  const voucherType = isReceipt ? 'RECEIPT' : 'PAYMENT'
  const noun = isReceipt ? 'receipt' : 'payment'

  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [role, setRole] = useState<Role | null>(null)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('')
  const [moneyAccountId, setMoneyAccountId] = useState('')
  const [otherAccountId, setOtherAccountId] = useState('')
  const [method, setMethod] = useState<Method>('cash')
  const [reference, setReference] = useState('')
  const [narration, setNarration] = useState('')

  const [busy, setBusy] = useState<'draft' | 'post' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ kind: 'draft' | 'posted'; id: string; sequenceNumber?: string } | null>(null)

  const [bills, setBills] = useState<BillOption[]>([])
  const [partyNames, setPartyNames] = useState<Record<string, string>>({})
  const [partyList, setPartyList] = useState<PartyOption[]>([])
  const [partyId, setPartyId] = useState('')
  const [billId, setBillId] = useState('')

  useEffect(() => {
    fetch('/api/v1/accounts')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('accounts'))))
      .then((j) => setAccounts(j.data ?? []))
      .catch(() => setError('Could not load the chart of accounts.'))
  }, [])

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  // Unpaid bills let a payment settle the supplier/customer account directly.
  useEffect(() => {
    fetch('/api/v1/invoices', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBills(j?.data ?? []))
      .catch(() => {})
    fetch('/api/v1/parties', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const map: Record<string, string> = {}
        for (const p of j?.data ?? []) map[p.id] = p.name
        setPartyNames(map)
        setPartyList(j?.data ?? [])
      })
      .catch(() => {})
  }, [])

  const MONEY_CODES = new Set(['1100', '1110', '1120', '1130'])

  // Money moves through cash, petty cash, bank or a mobile wallet — not through
  // receivables or inventory, which would create a nonsense entry.
  const assetAccounts = useMemo(() => {
    const assets = accounts.filter((a) => !a.isGroup && a.type === 'ASSET')
    const money = assets.filter((a) => MONEY_CODES.has(a.code))
    return money.length > 0 ? money : assets
  }, [accounts])

  const otherAccounts = useMemo(
    () => accounts.filter((a) => !a.isGroup && a.id !== moneyAccountId),
    [accounts, moneyAccountId],
  )

  const billType = isReceipt ? 'sale' : 'purchase'
  const eligibleBills = useMemo(
    () =>
      bills
        .filter(
          (b) =>
            b.type === billType &&
            (b.status === 'sent' || b.status === 'partially_paid') &&
            b.total - b.paid > 0,
        )
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')),
    [bills, billType],
  )
  const selectedBill = eligibleBills.find((b) => b.id === billId) ?? null
  const billOutstanding = selectedBill ? selectedBill.total - selectedBill.paid : 0

  const partyOptions = useMemo(
    () =>
      partyList.filter((p) =>
        isReceipt ? p.type === 'CUSTOMER' || p.type === 'BOTH' : p.type === 'SUPPLIER' || p.type === 'BOTH',
      ),
    [partyList, isReceipt],
  )
  const selectedParty = partyList.find((p) => p.id === partyId) ?? null

  // Cash in hand is the natural default; the user can switch to bank/mobile.
  useEffect(() => {
    if (moneyAccountId || assetAccounts.length === 0) return
    const preferred =
      assetAccounts.find((a) => a.code === '1100') ??
      assetAccounts.find((a) => a.code === '1120') ??
      assetAccounts[0]
    setMoneyAccountId(preferred.id)
  }, [assetAccounts, moneyAccountId])

  const moneyAccount = accounts.find((a) => a.id === moneyAccountId) ?? null
  const otherAccount = accounts.find((a) => a.id === otherAccountId) ?? null

  const amountMinor = minor(amount)
  const canWrite = role ? can(role, isReceipt ? 'receipt:write' : 'payment:write') : true

  const valid =
    canWrite &&
    amountMinor > 0 &&
    Boolean(moneyAccount) &&
    (selectedBill
      ? amountMinor <= billOutstanding
      : Boolean(otherAccount) && moneyAccountId !== otherAccountId)

  function chooseParty(id: string) {
    setPartyId(id)
    const party = partyList.find((p) => p.id === id)
    if (party && !otherAccountId) {
      const target = accounts.find((a) => !a.isGroup && a.code === (isReceipt ? '1200' : '2200'))
      if (target) setOtherAccountId(target.id)
    }
  }

  function chooseBill(id: string) {
    setBillId(id)
    setError(null)
    const bill = eligibleBills.find((b) => b.id === id)
    if (bill) setAmount(((bill.total - bill.paid) / 100).toFixed(2))
  }

  function reset(keepDefaults = true) {
    setDone(null)
    setError(null)
    setAmount('')
    setOtherAccountId('')
    setPartyId('')
    setBillId('')
    setReference('')
    setNarration('')
    if (!keepDefaults) {
      setDate(new Date().toISOString().slice(0, 10))
    }
  }

  function setToday() {
    setDate(new Date().toISOString().slice(0, 10))
  }

  async function submit(action: 'draft' | 'post') {
    if (!valid || busy) return
    const money = moneyAccount
    if (!money) return

    // Settling a bill posts the payment through the invoice settlement endpoint:
    // it writes the voucher, links the payment and updates the bill's status.
    if (selectedBill) {
      if (action === 'draft') {
        setError('A bill payment is posted immediately; save-as-draft is only for account entries.')
        return
      }
      setBusy('post')
      setError(null)
      try {
        const res = await fetch('/api/v1/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: selectedBill.id,
            amount: amountMinor,
            accountId: money.id,
            method,
            date,
            reference: reference.trim() || undefined,
          }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          setError(body?.error?.message ?? `Could not record the ${noun}.`)
          return
        }
        setDone({
          kind: 'posted',
          id: body?.data?.payment?.voucherId ?? selectedBill.id,
          sequenceNumber: body?.data?.sequenceNumber,
        })
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setBusy(null)
      }
      return
    }

    const other = otherAccount!
    const payeeName = selectedParty?.name ?? other.name
    const finalNarration =
      narration.trim() ||
      `${isReceipt ? 'Receipt from' : 'Payment to'} ${payeeName}${method ? ` via ${method}` : ''}`

    const entries = isReceipt
      ? [
          { accountId: money.id, accountType: 'ASSET' as const, debit: amountMinor, credit: 0, reference: reference.trim() || undefined },
          { accountId: other.id, accountType: other.type, debit: 0, credit: amountMinor, reference: reference.trim() || undefined },
        ]
      : [
          { accountId: other.id, accountType: other.type, debit: amountMinor, credit: 0, reference: reference.trim() || undefined },
          { accountId: money.id, accountType: 'ASSET' as const, debit: 0, credit: amountMinor, reference: reference.trim() || undefined },
        ]

    setBusy(action)
    setError(null)
    try {
      const created = await fetch('/api/v1/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, narration: finalNarration, voucherType }),
      })
      const createdBody = await created.json().catch(() => null)
      if (!created.ok) {
        setError(createdBody?.error?.message ?? `Could not create the ${noun}.`)
        return
      }
      const id: string | undefined = createdBody?.data?.id
      if (!id) {
        setError(`Could not create the ${noun}.`)
        return
      }

      if (action === 'post') {
        const posted = await fetch(`/api/v1/vouchers/${id}/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            narration: finalNarration,
            voucherType,
            entries,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        const postedBody = await posted.json().catch(() => null)
        if (!posted.ok) {
          setError(
            `${postedBody?.error?.message ?? `Could not post the ${noun}.`} It was kept as a draft.`,
          )
          return
        }
        setDone({ kind: 'posted', id, sequenceNumber: postedBody?.data?.sequenceNumber })
        return
      }

      const saved = await fetch(`/api/v1/vouchers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, narration: finalNarration, entries }),
      })
      const savedBody = await saved.json().catch(() => null)
      if (!saved.ok) {
        setError(savedBody?.error?.message ?? `Could not save the ${noun} draft.`)
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
            {done.kind === 'posted' ? `${isReceipt ? 'Receipt' : 'Payment'} posted` : 'Draft saved'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {done.kind === 'posted'
              ? 'Numbered for this fiscal year and locked against edits.'
              : 'You can keep editing it until it is posted.'}
          </p>
          {done.sequenceNumber && (
            <p className="mt-3 inline-block rounded-lg bg-gray-50 px-3 py-1.5 font-mono text-sm text-gray-700">
              {done.sequenceNumber}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Record another
            </button>
            <Link
              href={`/dashboard/vouchers/${done.id}`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              View voucher
            </Link>
            <Link href={listHref} className="px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700">
              Back to {isReceipt ? 'receipts' : 'payments'}
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Link
        href={listHref}
        className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-700"
      >
        <ArrowLeft size={13} aria-hidden />
        {isReceipt ? 'Receipts' : 'Payments'}
      </Link>

      <PageHeader
        title={isReceipt ? 'New receipt' : 'New payment'}
        description={
          isReceipt
            ? 'Money received into cash or bank. Debits the money account and credits the party or account it came from.'
            : 'Money paid out of cash or bank. Credits the money account and debits the party or expense it went to.'
        }
      />

      {role && !canWrite && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Your role cannot record {isReceipt ? 'receipts' : 'payments'}.
        </p>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="money-date" className="mb-1.5 block text-sm font-medium text-gray-700">
              Date
            </label>
            <input
              id="money-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
            <button type="button" onClick={setToday} className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline">
              Today
            </button>
          </div>

          <div>
            <label htmlFor="money-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Amount (৳)
            </label>
            <input
              id="money-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
              onBlur={() => {
                const n = parseTaka(amount)
                if (n > 0) setAmount(n.toFixed(2))
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-right text-lg font-semibold tabular-nums text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="money-bill" className="mb-1.5 block text-sm font-medium text-gray-700">
              {isReceipt ? 'Customer invoice (optional)' : 'Supplier bill (optional)'}
            </label>
            <select
              id="money-bill"
              value={billId}
              onChange={(e) => chooseBill(e.target.value)}
              disabled={busy !== null}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            >
              <option value="">— No specific bill — settle an account directly —</option>
              {eligibleBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.number ?? bill.id.slice(0, 8)} · {partyNames[bill.customerId ?? ''] ?? '—'} ·{' '}
                  {formatTaka(bill.total - bill.paid)} due
                </option>
              ))}
            </select>
            {selectedBill ? (
              <p className="mt-1 text-[11px] text-blue-700">
                Paying {partyNames[selectedBill.customerId ?? ''] ?? 'the party'} against{' '}
                {selectedBill.number ?? 'this bill'} · outstanding {formatTaka(billOutstanding)}.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400">
                Choose a bill to settle it and update its paid status, or leave blank to post against a ledger account.
                {eligibleBills.length === 0 && ' No unpaid bills yet.'}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="money-account" className="mb-1.5 block text-sm font-medium text-gray-700">
              {isReceipt ? 'Received into' : 'Paid from'}
            </label>
            <AccountPicker
              id="money-account"
              accounts={assetAccounts}
              value={moneyAccountId}
              onChange={(picked) => {
                setMoneyAccountId(picked?.id ?? '')
                if (otherAccountId === picked?.id) setOtherAccountId('')
              }}
              placeholder="Cash / bank account"
              disabled={busy !== null}
            />
            <p className="mt-1 text-[11px] text-gray-400">Cash, bank or mobile wallet.</p>
          </div>

          {!selectedBill && (
            <div>
              <label htmlFor="money-party" className="mb-1.5 block text-sm font-medium text-gray-700">
                {isReceipt ? 'Received from (customer)' : 'Paid to (supplier)'}
              </label>
              <select
                id="money-party"
                value={partyId}
                onChange={(e) => chooseParty(e.target.value)}
                disabled={busy !== null}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="">— Choose a {isReceipt ? 'customer' : 'supplier'} (optional) —</option>
                {partyOptions.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-400">
                {selectedParty
                  ? 'The party is named in the narration.'
                  : `Selecting a party fills the ${isReceipt ? 'receivable' : 'payable'} account.`}
              </p>
            </div>
          )}

          {!selectedBill && (
            <div>
              <label htmlFor="money-other" className="mb-1.5 block text-sm font-medium text-gray-700">
                Ledger account
              </label>
              <AccountPicker
                id="money-other"
                accounts={otherAccounts}
                value={otherAccountId}
                onChange={(picked) => setOtherAccountId(picked?.id ?? '')}
                placeholder={isReceipt ? 'Customer or income account' : 'Supplier, expense or payable'}
                disabled={busy !== null}
              />
              {otherAccount && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Will {isReceipt ? 'credit' : 'debit'} as <span className="font-medium text-gray-500">{otherAccount.type}</span>.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="money-method" className="mb-1.5 block text-sm font-medium text-gray-700">
              Method
            </label>
            <select
              id="money-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="money-reference" className="mb-1.5 block text-sm font-medium text-gray-700">
              Reference <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="money-reference"
              placeholder="Cheque / transaction no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          {!selectedBill && (
            <div className="sm:col-span-2">
              <label htmlFor="money-narration" className="mb-1.5 block text-sm font-medium text-gray-700">
                Narration <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="money-narration"
                placeholder={
                  otherAccount
                    ? `${isReceipt ? 'Receipt from' : 'Payment to'} ${otherAccount.name} via ${method}`
                    : `Auto-generated from the account and method`
                }
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          )}
        </div>

        {selectedBill ? (
          <div className="mt-4 grid gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2.5 text-xs text-blue-900 sm:grid-cols-2">
            <p>
              <span className="font-semibold">Bill</span> {selectedBill.number ?? selectedBill.id.slice(0, 8)} ·{' '}
              {partyNames[selectedBill.customerId ?? ''] ?? 'the party'} · {formatTaka(billOutstanding)} due
            </p>
            <p>
              <span className="font-semibold">Debit</span> payable · <span className="font-semibold">Credit</span>{' '}
              {moneyAccount?.name} · {formatTaka(amountMinor)}
            </p>
          </div>
        ) : moneyAccount && otherAccount && amountMinor > 0 ? (
          <div className="mt-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-gray-900">Debit</span>{' '}
              {(isReceipt ? moneyAccount : otherAccount)?.name} · {formatTaka(amountMinor)}
            </p>
            <p>
              <span className="font-semibold text-gray-900">Credit</span>{' '}
              {(isReceipt ? otherAccount : moneyAccount)?.name} · {formatTaka(amountMinor)}
            </p>
          </div>
        ) : null}
      </div>

      {error && <div className="mt-3"><FormAlert message={error} /></div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit('post')}
          disabled={!valid || busy !== null}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'post' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
          {busy === 'post' ? 'Posting...' : `Save & post ${noun}`}
        </button>
        <button
          type="button"
          onClick={() => submit('draft')}
          disabled={!valid || busy !== null || Boolean(selectedBill)}
          title={selectedBill ? 'Bill payments post immediately' : undefined}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === 'draft' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
          {busy === 'draft' ? 'Saving...' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => reset(false)}
          disabled={busy !== null}
          className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-gray-700 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </main>
  )
}