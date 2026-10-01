import type { Metadata } from 'next'
import { getVoucher } from '@/db/repo/vouchers'
import { requireScope } from '@/db/scope'
import { notFound } from 'next/navigation'
import { formatTakaFromMinor, formatDateBd } from '@neurobook/shared/format'
import { voucherTypeLabel } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'

export const metadata: Metadata = { title: 'Voucher' }

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const scope = await requireScope()
  const voucher = await getVoucher(scope, id)
  if (!voucher) notFound()

  return (
    <article className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {voucherTypeLabel(voucher.voucherType as VoucherType)}
            {voucher.sequenceNumber ? ` · ${voucher.sequenceNumber}` : ' · (draft)'}
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {formatDateBd(voucher.date)} · {voucher.status}
          </p>
        </div>
        <p className="text-sm font-medium">
          {formatTakaFromMinor(voucher.totalDebit)}
        </p>
      </header>
      <p>{voucher.narration}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Debit</th>
            <th className="py-2 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {voucher.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2">{l.accountId}</td>
              <td className="py-2 text-right">{formatTakaFromMinor(l.debit)}</td>
              <td className="py-2 text-right">{formatTakaFromMinor(l.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}
