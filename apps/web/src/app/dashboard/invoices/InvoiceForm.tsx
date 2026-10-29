'use client'

import SalesInvoiceForm from '@/ui/SalesInvoiceForm'
import PurchaseInvoiceForm from '@/ui/PurchaseInvoiceForm'

/**
 * Invoice entry form. Sales and purchase invoices share the same shape, so this
 * picks the variant and the pages stay thin.
 */
export default function InvoiceForm({ type = 'sale' }: { type?: 'sale' | 'purchase' }) {
  return type === 'purchase' ? <PurchaseInvoiceForm /> : <SalesInvoiceForm />
}