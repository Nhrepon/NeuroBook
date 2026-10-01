import type { Metadata } from 'next'
import Link from 'next/link'
import { listInvoices } from '@/db/repo/invoices'
import { requireScope } from '@/db/scope'
import { formatTakaFromMinor, formatDateBd } from '@/shared/format'

export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const scope = await requireScope()
  const rows = await listInvoices(scope, 50)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded bg-[hsl(var(--primary))] px-3 py-1.5 text-sm text-[hsl(var(--primary-foreground))]"
        >
          New invoice
        </Link>
      </header>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--accent))] text-left">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Voucher</th>
              <th className="px-3 py-2 text-right">Grand total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.payload as { totals?: { grandTotalMinor: number }; voucherType?: string }
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{formatDateBd(r.date)}</td>
                  <td className="px-3 py-2">{p?.voucherType ?? 'SALES_INVOICE'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.voucherId?.slice(0, 8) ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {formatTakaFromMinor(p?.totals?.grandTotalMinor ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link className="text-sm underline" href={`/api/v1/invoices/${r.id}/pdf`}>
                      PDF
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[hsl(var(--muted-foreground))]">
                  No invoices yet. <Link className="underline" href="/invoices/new">Create one</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
