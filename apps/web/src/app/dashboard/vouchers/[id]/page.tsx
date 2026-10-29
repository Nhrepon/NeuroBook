'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, Loader2, Lock, Pencil, RotateCcw, Scale, Send,
} from 'lucide-react'
import { can, formatTaka, voucherTypePermission, type AccountType, type Role, type VoucherType } from '@neurobook/shared'
import { voucherStatusBadge, voucherTypeLabel } from '@/lib/voucher-ui'
import { FormAlert } from '@/ui/Field'
import type { LedgerAccount } from '@/ui/AccountPicker'

interface Line {
  id: string
  accountId: string
  accountType: AccountType
  debit: number
  credit: number
  reference: string | null
}

interface VoucherDetail {
  id: string
  date: string
  narration: string
  voucherType: VoucherType
  status: 'draft' | 'posted' | 'reversed'
  version: number
  sequenceNumber: string | null
  reversedById: string | null
  createdAt?: string
  updatedAt?: string
  lines: Line[]
}

export default function VoucherDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState<'post' | 'reverse' | null>(null)
  const [confirming, setConfirming] = useState<'post' | 'reverse' | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/vouchers/${id}`)
      if (res.status === 404) throw new Error('This voucher no longer exists.')
      if (!res.ok) throw new Error('Could not load this voucher.')
      const json = await res.json()
      setVoucher(json.data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this voucher.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    fetch('/api/v1/accounts')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('accounts'))))
      .then((j) => setAccounts(j.data ?? []))
      .catch(() => {})
    fetch('/api/v1/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.data?.role && setRole(j.data.role))
      .catch(() => {})
  }, [load])

  const canWrite = voucher ? (role ? can(role, voucherTypePermission(voucher.voucherType)) : true) : false

  const lines = useMemo(() => voucher?.lines ?? [], [voucher])
  const totals = useMemo(
    () =>
      lines.reduce((acc, l) => ({ debit: acc.debit + l.debit, credit: acc.credit + l.credit }), {
        debit: 0,
        credit: 0,
      }),
    [lines],
  )
  const balanced = totals.debit === totals.credit && totals.debit > 0

  function accountLabel(accountId: string) {
    const account = accounts.find((a) => a.id === accountId)
    return account ? { code: account.code, name: account.name } : { code: '—', name: 'Unknown account' }
  }

  async function post() {
    if (!voucher) return
    setBusy('post')
    setError(null)
    setConfirming(null)

    try {
      const res = await fetch(`/api/v1/vouchers/${voucher.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: voucher.date.slice(0, 10),
          narration: voucher.narration,
          voucherType: voucher.voucherType,
          entries: lines.map((l) => ({
            accountId: l.accountId,
            accountType: l.accountType,
            debit: l.debit,
            credit: l.credit,
            reference: l.reference ?? undefined,
          })),
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not post this voucher.')
        return
      }
      setSuccess(`Posted as ${json?.data?.sequenceNumber ?? 'voucher'}.`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function reverse() {
    if (!voucher) return
    setBusy('reverse')
    setError(null)
    setConfirming(null)

    try {
      const res = await fetch(`/api/v1/vouchers/${voucher.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not reverse this voucher.')
        return
      }
      setSuccess(`Reversed with ${json?.data?.sequenceNumber ?? 'a new voucher'}. The original stays in the books.`)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl">
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Loading voucher…
        </p>
      </main>
    )
  }

  if (!voucher) {
    return (
      <main className="mx-auto max-w-2xl">
        <FormAlert message={error ?? 'Voucher not found.'} />
        <Link href="/dashboard/vouchers" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
          Back to vouchers
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl">
      <Link href="/dashboard/vouchers" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-700">
        <ArrowLeft size={13} aria-hidden />
        Vouchers
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold tracking-tight text-gray-900">
              {voucher.sequenceNumber ?? 'Unposted draft'}
            </h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${voucherStatusBadge(voucher.status)}`}>
              {voucher.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {voucherTypeLabel(voucher.voucherType)} ·{' '}
            {new Date(voucher.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · revision {voucher.version}
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <FormAlert message={error} />
        </div>
      )}

      {success && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
          {success}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Narration</p>
          <p className="mt-1 text-sm text-gray-900">{voucher.narration || <span className="text-gray-400">No narration</span>}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Ledger account</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Reference</th>
                <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                <th className="px-4 py-2.5 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    This draft has no ledger lines yet. Add them from the edit screen.
                  </td>
                </tr>
              )}

              {lines.map((line) => {
                const account = accountLabel(line.accountId)
                return (
                  <tr key={line.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">{account.code}</span>{' '}
                      <span className="text-gray-900">{account.name}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-gray-400">{line.accountType}</td>
                    <td className="px-4 py-2.5 text-gray-600">{line.reference || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {line.debit ? formatTaka(line.debit) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                      {line.credit ? formatTaka(line.credit) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {lines.length > 0 && (
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
                        <span className="text-red-600">Not balanced</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.debit)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatTaka(totals.credit)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {voucher.reversedById && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <RotateCcw size={14} className="mt-0.5 shrink-0" aria-hidden />
          Reversed by{' '}
          <Link href={`/dashboard/vouchers/${voucher.reversedById}`} className="font-medium text-blue-600 hover:underline">
            a reversal voucher
          </Link>
          . The original entry remains in the books.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {voucher.status === 'draft' && (
          <>
            <Link
              href={`/dashboard/vouchers/${voucher.id}/edit`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Pencil size={15} aria-hidden />
              Edit draft
            </Link>

            {confirming === 'post' ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={post}
                  disabled={busy !== null || !canWrite}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy === 'post' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
                  Confirm posting
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:text-gray-700"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming('post')}
                disabled={!canWrite}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={15} aria-hidden />
                Post voucher
              </button>
            )}
          </>
        )}

        {voucher.status === 'posted' &&
          (confirming === 'reverse' ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm text-amber-800">
                <AlertTriangle size={15} aria-hidden />
                This books a mirror entry that cannot be undone.
              </span>
              <button
                type="button"
                onClick={reverse}
                disabled={busy !== null || !canWrite}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy === 'reverse' ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RotateCcw size={15} aria-hidden />}
                Confirm reversal
              </button>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:text-gray-700"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming('reverse')}
              disabled={!canWrite}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={15} aria-hidden />
              Reverse
            </button>
          ))}

        {voucher.status === 'reversed' && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <Lock size={15} aria-hidden />
            This voucher has been reversed and is closed.
          </p>
        )}

        {role && !canWrite && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <AlertTriangle size={13} className="text-amber-500" aria-hidden />
            Your role can read this voucher but not change it.
          </p>
        )}
      </div>
    </main>
  )
}
