'use client'

import { VOUCHER_CATALOG, voucherTypeLabel } from '@/lib/voucher-ui'
import AccountPicker, { type LedgerAccount } from '@/ui/AccountPicker'
import { FormAlert } from '@/ui/Field'
import PageHeader from '@/ui/PageHeader'
import {
  can, formatTaka, toMinor, voucherTypePermission,
  type AccountType, type Role, type VoucherType,
} from '@neurobook/shared'
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Copy,
  Loader2, Plus, Save, Scale, Send, Sparkles, Trash2, Wand2
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

interface Line {
  key: string
  accountId: string
  reference: string
  debit: string
  credit: string
}

interface VoucherFormProps {
  mode: 'create' | 'edit'
  voucherId?: string
  /** Preselected type for create mode, used by the per-type ledger pages. */
  initialType?: VoucherType
}

/** Debounce-friendly amount parsing; the ledger stores integer minor units. */
function parseTaka(value: string): number {
  const cleaned = value.replace(/[,\s৳]/g, '')
  if (!cleaned) return 0
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function sanitizeAmount(value: string): string {
  return value.replace(/[^\d.,]/g, '')
}

function minor(amount: string): number {
  return toMinor(parseTaka(amount))
}

/** Common dr/cr patterns, resolved against the company's own chart of accounts. */
const TEMPLATES: Partial<Record<VoucherType, { side: 'debit' | 'credit'; match: string[] }[]>> = {
  SALES_INVOICE: [
    { side: 'debit', match: ['accounts receivable', 'receivable', '1200'] },
    { side: 'credit', match: ['sales revenue', 'sales', '4000'] },
  ],
  RECEIPT: [
    { side: 'debit', match: ['cash', 'bank', '1100'] },
    { side: 'credit', match: ['accounts receivable', 'receivable', '1200'] },
  ],
  PURCHASE_INVOICE: [
    { side: 'debit', match: ['general expense', 'expense', '5000', 'inventory'] },
    { side: 'credit', match: ['accounts payable', 'payable', '2100'] },
  ],
  PAYMENT: [
    { side: 'debit', match: ['accounts payable', 'payable', '2100'] },
    { side: 'credit', match: ['cash', 'bank', '1100'] },
  ],
  CONTRA: [
    { side: 'debit', match: ['bank', '1100'] },
    { side: 'credit', match: ['cash', '1000'] },
  ],
  JOURNAL: [
    { side: 'debit', match: ['cash', 'asset'] },
    { side: 'credit', match: ['general expense', 'expense'] },
  ],
}

/** The account-type rule the server enforces for each money-movement type. */
const SHAPE_HINT: Partial<Record<VoucherType, string>> = {
  PAYMENT: 'Credit cash or bank (an asset) and debit what the money paid for.',
  REFUND: 'Credit cash or bank (an asset) and debit the refund.',
  RECEIPT: 'Debit cash or bank (an asset) and credit the party who paid.',
  CONTRA: 'Move money between asset accounts only — cash and bank.',
  TRANSFER: 'Move money between asset accounts only — cash and bank.',
  SALES_INVOICE: 'Debit a receivable (asset) and credit revenue.',
  PURCHASE_INVOICE: 'Debit an expense and credit a payable (liability).',
}

export default function VoucherForm({ mode, voucherId, initialType }: VoucherFormProps) {
  const editMode = mode === 'edit'

  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  // null means "not resolved yet" — avoids flashing the least-privileged state.
  const [role, setRole] = useState<Role | null>(null)
  const [ready, setReady] = useState(!editMode)

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<VoucherType>(initialType ?? 'JOURNAL')
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { key: 'a', accountId: '', reference: '', debit: '', credit: '' },
    { key: 'b', accountId: '', reference: '', debit: '', credit: '' },
  ])
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'draft' | 'post' | null>(null)
  const [done, setDone] = useState<{ kind: 'draft' | 'posted'; id: string; sequenceNumber?: string } | null>(null)

  const lineSeq = useRef(0)
  function newLine(): Line {
    lineSeq.current += 1
    return { key: `l${Date.now()}-${lineSeq.current}`, accountId: '', reference: '', debit: '', credit: '' }
  }

  // Tally-style keyboard flow: picking a ledger drops the cursor on its amount,
  // and Enter walks to the next line instead of jumping out of the table.
  const debitRefs = useRef(new Map<string, HTMLInputElement>())
  const creditRefs = useRef(new Map<string, HTMLInputElement>())
  const accountDomId = (index: number) => `line-${index}-account`
  function focusAccount(index: number) {
    requestAnimationFrame(() => document.getElementById(accountDomId(index))?.focus())
  }
  function focusAmount(key: string, side: 'debit' | 'credit') {
    requestAnimationFrame(() => (side === 'debit' ? debitRefs : creditRefs).current.get(key)?.focus())
  }
  function focusDebit(key: string) {
    focusAmount(key, 'debit')
  }

  const allowedTypes = useMemo(
    () => VOUCHER_CATALOG.filter((v) => (role ? can(role, voucherTypePermission(v.type)) : true)),
    [role],
  )

  const groupedTypes = useMemo(() => {
    const groups = new Map<string, typeof allowedTypes>()
    for (const v of allowedTypes) {
      groups.set(v.group, [...(groups.get(v.group) ?? []), v])
    }
    return Array.from(groups.entries())
  }, [allowedTypes])

  const typeMeta = VOUCHER_CATALOG.find((v) => v.type === type)

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

  // In create mode the voucher type is chosen up front, so default to the first
  // type the signed-in role is actually allowed to raise.
  useEffect(() => {
    if (editMode || !role || allowedTypes.length === 0) return
    setType((current) => (allowedTypes.some((v) => v.type === current) ? current : allowedTypes[0].type))
  }, [allowedTypes, editMode, role])

  useEffect(() => {
    if (!editMode || !voucherId) return
    fetch(`/api/v1/vouchers/${voucherId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((j) => {
        const v = j.data
        if (!v) throw new Error('not found')
        setDate(new Date(v.date).toISOString().slice(0, 10))
        setNarration(v.narration ?? '')
        setType(v.voucherType as VoucherType)
        const loaded: Line[] = (v.lines ?? []).map((l: any) => ({
          key: `e${l.id}`,
          accountId: l.accountId,
          reference: l.reference ?? '',
          debit: l.debit ? String(l.debit / 100) : '',
          credit: l.credit ? String(l.credit / 100) : '',
        }))
        setLines(loaded.length >= 2 ? loaded : [...loaded, newLine(), newLine()].slice(0, Math.max(2, loaded.length)))
        setReady(true)
      })
      .catch(() => setError('Could not load this voucher.'))
  }, [editMode, voucherId])

  // Arriving from a specific ledger page (Sales, Receipts, ...) starts the entry
  // with that type's common ledgers already in place.
  const autoPrefilled = useRef(false)
  useEffect(() => {
    if (editMode || autoPrefilled.current || !initialType || accounts.length === 0) return
    autoPrefilled.current = true
    if (isBlank()) prefill(initialType)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, initialType, editMode])

  const totals = useMemo(() => {
    return lines.reduce(
      (acc, l) => ({ debit: acc.debit + minor(l.debit), credit: acc.credit + minor(l.credit) }),
      { debit: 0, credit: 0 },
    )
  }, [lines])

  const difference = totals.debit - totals.credit
  const balanced = difference === 0 && totals.debit > 0

  const filledLines = useMemo(
    () => lines.filter((l) => l.accountId && (minor(l.debit) > 0 || minor(l.credit) > 0)),
    [lines],
  )

  // Lines that are half-finished and would otherwise be dropped silently on save.
  const lineIssues = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of lines) {
      const debit = minor(l.debit)
      const credit = minor(l.credit)
      if (debit > 0 && credit > 0) m.set(l.key, 'Use only one side per line.')
      else if (!l.accountId && (debit > 0 || credit > 0)) m.set(l.key, 'Pick a ledger account for this amount.')
      else if (l.accountId && debit === 0 && credit === 0) m.set(l.key, 'Enter a debit or credit amount.')
    }
    return m
  }, [lines])

  const problems = useMemo(() => {
    const list: string[] = []
    if (!date) list.push('Pick a voucher date.')
    if (!narration.trim()) list.push('Add a narration so the entry is self-explanatory.')
    if (filledLines.length < 2) list.push('Pick at least two ledger accounts with amounts.')
    if (lineIssues.size > 0) list.push(`Finish or remove the ${lineIssues.size} highlighted line${lineIssues.size === 1 ? '' : 's'}.`)
    if (lines.some((l) => minor(l.debit) > 0 && minor(l.credit) > 0)) list.push('A line cannot hold both a debit and a credit.')
    if (!balanced && filledLines.length >= 2) {
      list.push(
        difference > 0
          ? `Debit exceeds credit by ${formatTaka(difference)}.`
          : `Credit exceeds debit by ${formatTaka(-difference)}.`,
      )
    }
    if (role && !can(role, voucherTypePermission(type))) list.push('Your role cannot raise this voucher type.')
    return list
  }, [date, narration, filledLines, lines, lineIssues, balanced, difference, role, type])

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((rows) => rows.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addLine() {
    const line = newLine()
    setLines((rows) => (rows.length === 1 ? [rows[0], line] : [...rows, line]))
    setFocusKey(line.key)
    setNotice(null)
  }

  function removeLine(key: string) {
    setLines((rows) => (rows.length <= 2 ? rows : rows.filter((l) => l.key !== key)))
  }

  function clearForm() {
    setError(null)
    setNotice(null)
    setNarration('')
    setLines([newLine(), newLine()])
  }

  /** Clears the entry but keeps the date and type, for posting a run of vouchers. */
  function startAnother() {
    setDone(null)
    setError(null)
    setNotice(null)
    setNarration('')
    setLines([newLine(), newLine()])
  }

  function duplicateLine(key: string) {
    const index = lines.findIndex((l) => l.key === key)
    if (index < 0) return
    const copy = { ...lines[index], key: newLine().key }
    setLines((rows) => [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)])
    setFocusKey(copy.key)
  }

  function balanceEntry() {
    if (difference === 0) return
    const side: 'debit' | 'credit' = difference > 0 ? 'credit' : 'debit'
    const amount = (Math.abs(difference) / 100).toFixed(2)

    // Prefer an empty line; only add a new one when the entry has none left.
    const target = [...lines].reverse().find((l) => minor(l.debit) === 0 && minor(l.credit) === 0)
    if (target) {
      setLines((rows) =>
        rows.map((l) =>
          l.key === target.key
            ? { ...l, debit: side === 'debit' ? amount : '', credit: side === 'credit' ? amount : '' }
            : l,
        ),
      )
      focusAmount(target.key, side)
      return
    }

    const line = newLine()
    setLines((rows) => [
      ...rows,
      { ...line, debit: side === 'debit' ? amount : '', credit: side === 'credit' ? amount : '' },
    ])
    setFocusKey(line.key)
  }

  function prefill(target: VoucherType = type) {
    const template = TEMPLATES[target]
    if (!template) {
      setNotice('No starter layout for this voucher type — pick the ledgers yourself.')
      return
    }

    const resolved = template.map((slot) => {
      const found = accounts.find(
        (a) =>
          !a.isGroup &&
          slot.match.some(
            (needle) => a.name.toLowerCase().includes(needle) || a.code === needle,
          ),
      )
      return { slot, account: found ?? null }
    })

    const hits = resolved.filter((r) => r.account)
    if (hits.length < 2) {
      setNotice('This company has no matching ledgers for that layout — pick the accounts manually.')
      return
    }

    setLines(
      hits.map((h) => ({
        key: newLine().key,
        accountId: h.account!.id,
        reference: '',
        debit: '',
        credit: '',
      })),
    )
    setFocusKey(null)
    setNotice(`${hits.map((h) => h.account!.name).join(' / ')} — add the amounts.`)
  }

  function isBlank(rows: Line[] = lines) {
    return rows.every((l) => !l.accountId && minor(l.debit) === 0 && minor(l.credit) === 0)
  }

  function changeType(next: VoucherType) {
    setType(next)
    setNotice(null)
    setFocusKey(null)
    // Only the starter ledgers for the new type — never overwrite a live entry.
    if (isBlank()) prefill(next)
  }

  function setToday() {
    setDate(new Date().toISOString().slice(0, 10))
  }

  /** Formats a typed amount to two decimals when the field loses focus. */
  function tidyAmount(key: string, side: 'debit' | 'credit', value: string) {
    const n = parseTaka(value)
    if (n <= 0) return
    updateLine(key, { [side]: n.toFixed(2) } as Partial<Line>)
  }

  async function save(action: 'draft' | 'post') {
    setError(null)
    setNotice(null)
    if (problems.length > 0) {
      setError(problems[0])
      return
    }

    const entries = filledLines.map((l) => ({
      accountId: l.accountId,
      accountType: (accounts.find((a) => a.id === l.accountId)?.type ?? 'ASSET') as AccountType,
      debit: minor(l.debit),
      credit: minor(l.credit),
      reference: l.reference.trim() || undefined,
    }))

    setBusy(action)
    try {
      let id = voucherId
      if (!id) {
        const created = await fetch('/api/v1/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, narration: narration.trim(), voucherType: type }),
        })
        if (!created.ok) {
          const body = await created.json().catch(() => null)
          setError(body?.error?.message ?? 'Could not create the voucher.')
          return
        }
        id = (await created.json()).data.id
      }

      if (!id) {
        setError('Could not create the voucher.')
        return
      }

      if (action === 'post') {
        const posted = await fetch(`/api/v1/vouchers/${id}/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            narration: narration.trim(),
            voucherType: type,
            entries,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        if (!posted.ok) {
          const body = await posted.json().catch(() => null)
          setError(`${body?.error?.message ?? 'Could not post the voucher.'}${editMode ? '' : ' It was kept as a draft.'}`)
          return
        }
        const body = await posted.json()
        setDone({ kind: 'posted', id, sequenceNumber: body.data?.sequenceNumber })
        return
      }

      const saved = await fetch(`/api/v1/vouchers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, narration: narration.trim(), entries }),
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

  function onFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!busy) save('post')
    }
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault()
      addLine()
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500" aria-hidden />
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            {done.kind === 'posted' ? 'Voucher posted' : 'Draft saved'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {done.kind === 'posted' ? 'Numbered for this fiscal year and locked against edits.' : 'You can keep editing it until it is posted.'}
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
            <button
              type="button"
              onClick={startAnother}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Record another
            </button>
            <Link href="/dashboard/vouchers" className="px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700">
              Back to list
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-7xl">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading voucher…
        </p>
      </main>
    )
  }

  const disabled = busy !== null

  return (
    <main className="mx-auto max-w-7xl">
      <Link href="/dashboard/vouchers" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-700">
        <ArrowLeft size={13} aria-hidden />
        Vouchers
      </Link>
      <PageHeader
        title={editMode ? 'Edit draft voucher' : 'New voucher'}
        description={
          editMode
            ? 'Drafts stay editable until posted; posting locks the voucher for good.'
            : 'Enter the ledgers and amounts. Numbering is gapless and applied when you post.'
        }
      />

      <form onSubmit={(e) => e.preventDefault()} onKeyDown={onFormKeyDown} className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-900">Voucher details</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="voucher-date" className="mb-1.5 block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                id="voucher-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
              <button
                type="button"
                onClick={setToday}
                className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline"
              >
                Today
              </button>
            </div>

            <div>
              <label htmlFor="voucher-type" className="mb-1.5 block text-sm font-medium text-gray-700">
                Voucher type
              </label>
              {editMode ? (
                <p className="flex h-[42px] items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {voucherTypeLabel(type)}
                  <span className="text-xs text-gray-400">fixed</span>
                </p>
              ) : (
                <select
                  id="voucher-type"
                  value={type}
                  disabled={allowedTypes.length === 0}
                  onChange={(e) => changeType(e.target.value as VoucherType)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                >
                  {groupedTypes.map(([group, items]) => (
                    <optgroup key={group} label={group}>
                      {items.map((v) => (
                        <option key={v.type} value={v.type}>
                          {v.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              <p className="mt-1.5 text-xs text-gray-400">{typeMeta?.hint}</p>
              {SHAPE_HINT[type] && (
                <p className="mt-1 text-xs text-blue-700/80">{SHAPE_HINT[type]}</p>
              )}
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Voucher number</span>
              <p className="flex h-[42px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-xs text-gray-500">
                {editMode ? 'assigned on posting' : 'auto · TYPE/FY/000001'}
              </p>
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="voucher-narration" className="mb-1.5 block text-sm font-medium text-gray-700">
                Narration
              </label>
              <input
                id="voucher-narration"
                required
                placeholder="e.g. Credit sale to Rahim Traders"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>

          {allowedTypes.length === 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              Your role cannot raise vouchers. Ask an admin for a role such as Accountant, Sales or Cashier.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-gray-900">Ledger entries</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => prefill()}
                disabled={disabled || !TEMPLATES[type]}
                title={TEMPLATES[type] ? 'Fill common ledgers for this voucher type' : 'No starter layout for this type'}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Sparkles size={13} aria-hidden />
                Suggest ledgers
              </button>
              <button
                type="button"
                onClick={addLine}
                disabled={disabled}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <Plus size={13} aria-hidden />
                Add line
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-2 text-right font-medium">#</th>
                  <th className="w-[44%] px-4 py-2 font-medium">Ledger account</th>
                  <th className="px-2 py-2 font-medium">Reference</th>
                  <th className="w-32 px-2 py-2 text-right font-medium">Debit (৳)</th>
                  <th className="w-32 px-2 py-2 text-right font-medium">Credit (৳)</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, index) => {
                  const account = accounts.find((a) => a.id === line.accountId)
                  const issue = lineIssues.get(line.key)
                  return (
                    <tr key={line.key} className={`align-top ${issue ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-2 py-3 text-right text-xs tabular-nums text-gray-400">{index + 1}</td>
                      <td className="px-4 py-2">
                        <AccountPicker
                          id={`line-${index}-account`}
                          accounts={accounts}
                          value={line.accountId}
                          autoFocus={focusKey === line.key}
                          disabled={disabled}
                          placeholder={index === 0 ? 'e.g. Cash' : 'Select ledger account'}
                          onChange={(picked) => {
                            updateLine(line.key, { accountId: picked?.id ?? '' })
                            if (picked) focusDebit(line.key)
                          }}
                        />
                        {issue ? (
                          <p className="mt-1 flex items-center gap-1 pl-1 text-[11px] text-amber-700">
                            <AlertTriangle size={11} aria-hidden />
                            {issue}
                          </p>
                        ) : (
                          account && (
                            <p className="mt-1 pl-1 text-[11px] text-gray-400">
                              Posts as <span className="font-medium text-gray-500">{account.type}</span>
                            </p>
                          )
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          aria-label={`Reference for line ${index + 1}`}
                          placeholder="invoice / cheque no."
                          value={line.reference}
                          disabled={disabled}
                          onChange={(e) => updateLine(line.key, { reference: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          ref={(el) => {
                            if (el) debitRefs.current.set(line.key, el)
                            else debitRefs.current.delete(line.key)
                          }}
                          aria-label={`Debit amount for line ${index + 1}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.debit}
                          disabled={disabled}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => updateLine(line.key, { debit: sanitizeAmount(e.target.value), credit: '' })}
                          onBlur={(e) => tidyAmount(line.key, 'debit', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (index < lines.length - 1) focusAccount(index + 1)
                              else addLine()
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-right text-sm tabular-nums outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          ref={(el) => {
                            if (el) creditRefs.current.set(line.key, el)
                            else creditRefs.current.delete(line.key)
                          }}
                          aria-label={`Credit amount for line ${index + 1}`}
                          inputMode="decimal"
                          placeholder="0.00"
                          value={line.credit}
                          disabled={disabled}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => updateLine(line.key, { credit: sanitizeAmount(e.target.value), debit: '' })}
                          onBlur={(e) => tidyAmount(line.key, 'credit', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (index < lines.length - 1) focusAccount(index + 1)
                              else addLine()
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-right text-sm tabular-nums outline-none transition placeholder:text-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => duplicateLine(line.key)}
                            disabled={disabled}
                            aria-label={`Duplicate line ${index + 1}`}
                            title="Duplicate line"
                            className="rounded p-1.5 text-gray-400 transition hover:text-blue-600 disabled:opacity-30"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            disabled={lines.length <= 2 || disabled}
                            aria-label={`Remove line ${index + 1}`}
                            title="Remove line"
                            className="rounded p-1.5 text-gray-400 transition hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50 text-sm">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Scale size={13} aria-hidden />
                      {balanced ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-600">
                          <Check size={13} aria-hidden />
                          Balanced
                        </span>
                      ) : (
                        'Totals must match before saving'
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.debit)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.credit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {!balanced && filledLines.length >= 2 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 sm:px-5">
              <p className="text-xs text-amber-700">
                Difference {formatTaka(Math.abs(difference))} on the {difference > 0 ? 'credit' : 'debit'} side.
              </p>
              <button
                type="button"
                onClick={balanceEntry}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <Wand2 size={13} aria-hidden />
                Balance entry
              </button>
            </div>
          )}

          {notice && (
            <p className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500 sm:px-5">
              <Sparkles size={12} className="mr-1 inline" aria-hidden />
              {notice}
            </p>
          )}
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

        <div className="sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => save('post')}
            disabled={disabled || problems.length > 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'post' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
            {busy === 'post' ? 'Posting…' : 'Save & post'}
          </button>
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={disabled || problems.length > 0}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'draft' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
            {busy === 'draft' ? 'Saving…' : editMode ? 'Save draft' : 'Save as draft'}
          </button>
          <button
            type="button"
            onClick={clearForm}
            disabled={disabled}
            className="rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-gray-700 disabled:opacity-50"
          >
            Clear
          </button>
          <span className="ml-auto hidden text-xs text-gray-400 sm:block">
            Ctrl+Enter posts · Alt+A adds a line · Enter moves to the next line
          </span>
        </div>
      </form>
    </main>
  )
}
