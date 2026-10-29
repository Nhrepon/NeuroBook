'use client'

import MoneyForm from '@/ui/MoneyForm'

/** Money in: a focused receipt entry instead of the generic journal form. */
export default function ReceiptForm() {
  return <MoneyForm direction="in" listHref="/dashboard/receipts" />
}