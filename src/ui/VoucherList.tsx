'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'
import { VOUCHER_TYPE_ORDER, voucherTypeSpec, voucherTypeLabel } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'
import type { VoucherListItem } from '@/db/repo/vouchers'

export function VoucherList({
  initial,
  nextCursor,
  initialStatus,
  initialType,
}: {
  initial: VoucherListItem[]
  nextCursor: string | null
  initialStatus?: string
  initialType?: VoucherType
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, start] = useTransition()

  /**
   * Changing a filter resets to page 1. Keeping the old cursor would push the
   * user further into the previous result set while the filter had changed,
   * which reads as "the filter returned nothing".
   */
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('cursor')
    start(() => router.push(`?${next.toString()}`))
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm">
          Status{' '}
          <select
            defaultValue={initialStatus ?? ''}
            onChange={(e) => setParam('status', e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
        </label>
        <label className="text-sm">
          Type{' '}
          <select
            defaultValue={initialType ?? ''}
            onChange={(e) => setParam('type', e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {VOUCHER_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {voucherTypeSpec(t).label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--accent))] text-left">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Sequence</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((v) => (
              <tr key={v.id} className="border-t hover:bg-[hsl(var(--accent))]">
                <td className="px-3 py-2">
                  <Link href={`/vouchers/${v.id}`} className="hover:underline">
                    {voucherTypeLabel(v.voucherType as VoucherType)}
                  </Link>
                </td>
                <td className="px-3 py-2">{formatDateBd(v.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{v.sequenceNumber ?? '—'}</td>
                <td className="px-3 py-2 text-right">{formatTakaFromMinor(v.totalDebit)}</td>
                <td className="px-3 py-2">{v.status}</td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No vouchers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-sm">
        {nextCursor ? (
          <Link href={`?cursor=${nextCursor}`} className="underline">Next page</Link>
        ) : <span />}
        {pending && <span className="text-[hsl(var(--muted-foreground))]">Loading…</span>}
      </div>
    </>
  )
}
