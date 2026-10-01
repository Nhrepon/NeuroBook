import Link from 'next/link'
import type { InvoiceRow } from '@/db/repo/invoices'
import { formatDateBd, formatTakaFromMinor } from '@/shared/format'

/**
 * Invoice rows for the activity region.
 *
 * The document totals live inside the `payload` jsonb, so they are read
 * defensively: an invoice written by an older shape must render as an invoice
 * with a blank total, never crash the dashboard.
 */
interface InvoicePayload {
  totals?: { grandTotalMinor?: number }
  voucherType?: string
}

export function RecentInvoices({ items }: { items: InvoiceRow[] }) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No invoices yet.{' '}
        <Link className="underline" href="/invoices/new">
          Create one
        </Link>
        .
      </p>
    )
  }

  return (
    <ul className="divide-y">
      {items.map((r) => {
        const payload = r.payload as InvoicePayload
        const grand = payload?.totals?.grandTotalMinor
        return (
          <li key={r.id} className="py-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">
                <Link href={`/api/v1/invoices/${r.id}/pdf`} className="font-medium hover:underline">
                  {(payload?.voucherType ?? 'SALES_INVOICE').replace(/_/g, ' ')}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">{formatDateBd(r.date)}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {grand === undefined ? '—' : formatTakaFromMinor(grand)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{r.voucherId?.slice(0, 8) ?? 'unlinked'}</span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}
