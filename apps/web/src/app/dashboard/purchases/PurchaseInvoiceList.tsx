'use client'

import InvoicesManager from '@/ui/InvoicesManager'

/** Purchase bills: the same workspace filtered to supplier invoices. */
export default function PurchaseInvoiceList() {
  return <InvoicesManager fixedType="purchase" />
}