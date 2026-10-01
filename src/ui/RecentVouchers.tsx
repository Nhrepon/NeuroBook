import Link from 'next/link'
import type { VoucherListItem } from '@/db/repo/vouchers'
import { formatDateBd, formatTakaFromMinor } from '@/shared/format'
import { Badge, voucherTone } from './Badge'

/**
 * The voucher list for the activity region.
 *
 * Renders `listVouchers` output in the order it received it — now
 * `(date DESC, id DESC)`. The previous dashboard ordered by `vouchers.id`, a
 * random UUID, so "recent" meant nothing.
 */
export function RecentVouchers({ items }: { items: VoucherListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No vouchers yet.{' '}
        <Link className="underline" href="/vouchers/new">
          Create one
        </Link>
        .
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {items.map((v) => (
        <li key={v.id} className="py-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">
              <Link href={`/vouchers/${v.id}`} className="font-medium hover:underline">
                {v.voucherType.replace(/_/g, ' ')}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">{formatDateBd(v.date)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge tone={voucherTone(v.status)}>{v.status}</Badge>
              <span className="tabular-nums">{formatTakaFromMinor(v.totalDebit)}</span>
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{v.narration}</span>
            <span className="ml-auto shrink-0 font-mono">{v.sequenceNumber ?? 'draft'}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

