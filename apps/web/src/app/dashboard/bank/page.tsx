'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Landmark, Loader2, Plus, X } from 'lucide-react'
import { can, formatTaka, toMinor, type Role } from '@neurobook/shared'
import Field, { FormAlert } from '@/ui/Field'
import { parseTaka, sanitizeAmount } from '@/lib/money-input'

interface BankAccount {
  id: string
  name: string
  bankName: string | null
  accountNumber: string | null
  currency: string
  openingBalance: number
  active: boolean
}

interface BankTransaction {
  id: string
  bankAccountId: string
  date: string
  description: string | null
  amount: number
  type: 'debit' | 'credit'
  reconciled: boolean
}

const controlClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

export default function BankPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [txs, setTxs] = useState<BankTransaction[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [showAccountForm, setShowAccountForm] = useState(false)
  const [name, setName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')

  const [showTxForm, setShowTxForm] = useState(false)
  const [txAccountId, setTxAccountId] = useState('')
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txDescription, setTxDescription] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txType, setTxType] = useState<'debit' | 'credit'>('debit')

  const [saving, setSaving] = useState(false)

  const accountName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const a of accounts) map[a.id] = a.name
    return map
  }, [accounts])

  async function load() {
    setLoading(true)
    try {
      const [aRes, tRes] = await Promise.all([fetch('/api/v1/bank/accounts'), fetch('/api/v1/bank/transactions')])
      if (!aRes.ok || !tRes.ok) throw new Error('Could not load bank data')
      const a = await aRes.json()
      const t = await tRes.json()
      setAccounts(a.data ?? [])
      setTxs(t.data ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load bank data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [])

  const canWrite = role ? can(role, 'bank:write') : true

  const sortedTxs = useMemo(
    () => [...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [txs],
  )

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !canWrite) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bankName: bankName.trim() || undefined,
          accountNumber: accountNumber.trim() || undefined,
          openingBalance: toMinor(parseTaka(openingBalance)),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not create the bank account.')
        return
      }
      setName('')
      setBankName('')
      setAccountNumber('')
      setOpeningBalance('')
      setShowAccountForm(false)
      setNotice('Bank account added.')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function createTx(e: React.FormEvent) {
    e.preventDefault()
    if (!txAccountId || !canWrite) return
    const amountMinor = toMinor(parseTaka(txAmount))
    if (amountMinor <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/bank/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: txAccountId,
          date: txDate,
          description: txDescription.trim() || undefined,
          amount: amountMinor,
          type: txType,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? 'Could not record the transaction.')
        return
      }
      setTxDescription('')
      setTxAmount('')
      setShowTxForm(false)
      setNotice('Bank transaction recorded.')
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleButton = (open: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!canWrite}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
        canWrite ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-gray-100 text-gray-400 shadow-none'
      }`}
    >
      {open ? <X size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
      {open ? 'Cancel' : label}
    </button>
  )

  return (
    <main className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Landmark size={22} className="text-blue-600" aria-hidden />
          Bank
        </h1>
        <p className="mt-1 text-sm text-gray-500">Bank accounts and the statement lines you reconcile against posted vouchers.</p>
      </header>

      {role && !canWrite && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Your role can view bank data but not change it.
        </p>
      )}

      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</p>
      )}

      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Accounts</h2>
          {toggleButton(showAccountForm, 'New account', () => canWrite && setShowAccountForm((v) => !v))}
        </div>

        {showAccountForm && canWrite && (
          <form onSubmit={createAccount} className="mb-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Account name" required placeholder="City Bank – Current" value={name} onChange={(e) => setName(e.target.value)} />
              <Field label="Bank" optional placeholder="City Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <Field label="Account number" optional placeholder="1234567890" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              <Field
                label="Opening balance (৳)"
                optional
                inputMode="decimal"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(sanitizeAmount(e.target.value))}
              />
            </div>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {saving ? 'Saving...' : 'Save account'}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Bank</th>
                  <th className="px-4 py-2.5 font-medium">Account no.</th>
                  <th className="px-4 py-2.5 text-right font-medium">Opening balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 size={15} className="animate-spin" aria-hidden />
                        Loading bank data...
                      </span>
                    </td>
                  </tr>
                )}
                {!loading && accounts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      No bank accounts yet.
                    </td>
                  </tr>
                )}
                {!loading &&
                  accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-2.5 text-gray-700">{a.bankName || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{a.accountNumber || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">{formatTaka(a.openingBalance)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Transactions</h2>
          {toggleButton(showTxForm, 'New transaction', () => {
            if (!canWrite) return
            if (accounts.length === 0) {
              setError('Add a bank account first.')
              return
            }
            setTxAccountId((cur) => cur || accounts[0].id)
            setShowTxForm((v) => !v)
          })}
        </div>

        {showTxForm && canWrite && (
          <form onSubmit={createTx} className="mb-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label htmlFor="tx-account" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Bank account
                </label>
                <select id="tx-account" className={controlClass} value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Date" type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} />
              <Field label="Description" optional placeholder="Cheque / transfer" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} />
              <div>
                <label htmlFor="tx-type" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Direction
                </label>
                <select id="tx-type" className={controlClass} value={txType} onChange={(e) => setTxType(e.target.value as 'debit' | 'credit')}>
                  <option value="debit">Debit (money in)</option>
                  <option value="credit">Credit (money out)</option>
                </select>
              </div>
              <Field
                label="Amount (৳)"
                required
                inputMode="decimal"
                placeholder="0.00"
                value={txAmount}
                onChange={(e) => setTxAmount(sanitizeAmount(e.target.value))}
              />
            </div>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {saving ? 'Saving...' : 'Record transaction'}
              </button>
            </div>
          </form>
        )}

        {error && <div className="mb-3"><FormAlert message={error} /></div>}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!loading && sortedTxs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                      No bank transactions yet.
                    </td>
                  </tr>
                )}
                {!loading &&
                  sortedTxs.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                        {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-900">{accountName[t.bankAccountId] ?? <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-gray-700">{t.description || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{formatTaka(t.amount)}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            t.type === 'debit' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'
                          }`}
                        >
                          {t.type === 'debit' ? 'Money in' : 'Money out'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}
