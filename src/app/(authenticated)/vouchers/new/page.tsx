import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { VoucherForm } from '@/ui/VoucherForm'
import { listAccounts } from '@/db/repo/accounts'
import { requireScope } from '@/db/scope'
import { isVoucherType, invoicePathFor } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'

export const metadata: Metadata = { title: 'New voucher' }

export default async function NewVoucherPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const sp = await searchParams
  const scope = await requireScope()
  const accounts = await listAccounts(scope)
  // The sidebar's voucher-type group links here with `?type=`. A stale or
  // hand-edited value falls back to the form's default rather than throwing:
  // an unknown type should not block creating a voucher.
  const type = sp.type && isVoucherType(sp.type) ? (sp.type as VoucherType) : undefined

  // Each voucher type has exactly one owning form. A document type arriving
  // here — from the sidebar, a stale bookmark, or the old `?type=` links —
  // goes to the form that can actually produce a compliant document, rather
  // than being rendered on a form that cannot.
  const invoicePath = type ? invoicePathFor(type) : null
  if (invoicePath) redirect(invoicePath)

  // An empty date failed the `YYYY-MM-DD` schema on the server and the user was
  // told "Use YYYY-MM-DD" by a form that had an empty field they never touched.
  // An accounting entry is for a day; today is the overwhelmingly common one.
  // Computed on the server so the client does not re-derive it and disagree
  // across a midnight boundary or a timezone.
  const today = new Date().toISOString().slice(0, 10)

  return <VoucherForm accounts={accounts} initialType={type} initialDate={today} />
}
