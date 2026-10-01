import type { Metadata } from 'next'
import { listVouchers } from '@/db/repo/vouchers'
import { requireScope } from '@/db/scope'
import { isVoucherType } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'
import { VoucherList } from '@/ui/VoucherList'

export const metadata: Metadata = { title: 'Vouchers' }

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; cursor?: string }>
}) {
  const sp = await searchParams
  const scope = await requireScope()
  // An unrecognised `?type=` is ignored rather than throwing: a stale or
  // hand-edited link should show the full list, not a 500.
  const type = sp.type && isVoucherType(sp.type) ? (sp.type as VoucherType) : undefined
  const { items, nextCursor } = await listVouchers(scope, {
    status: (sp.status as 'draft' | 'posted' | 'reversed' | undefined) ?? undefined,
    type,
    cursor: sp.cursor,
  })

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vouchers</h1>
        <a
          href="/vouchers/new"
          className="rounded bg-[hsl(var(--primary))] px-3 py-1.5 text-sm text-[hsl(var(--primary-foreground))]"
        >
          New voucher
        </a>
      </header>
      <VoucherList
        initial={items}
        nextCursor={nextCursor}
        initialStatus={sp.status}
        initialType={type}
      />
    </div>
  )
}
