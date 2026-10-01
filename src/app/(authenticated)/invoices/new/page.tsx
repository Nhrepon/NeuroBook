import type { Metadata } from 'next'
import { requireScope } from '@/db/scope'
import { listAccounts } from '@/db/repo/accounts'
import { InvoiceForm } from '@/ui/InvoiceForm'

export const metadata: Metadata = { title: 'New invoice' }

export default async function NewInvoicePage() {
  const scope = await requireScope()
  const accounts = await listAccounts(scope)
  return <InvoiceForm accounts={accounts} />
}
