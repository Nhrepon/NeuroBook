'use client'

import MoneyForm from '@/ui/MoneyForm'

/** Money out: a focused payment entry instead of the generic journal form. */
export default function PaymentForm() {
  return <MoneyForm direction="out" listHref="/dashboard/payments" />
}