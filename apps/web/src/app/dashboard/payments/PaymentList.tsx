'use client'

import { ArrowUpRight } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

/** Day-book of money paid out, with its own entry screen. */
export default function PaymentList() {
  return (
    <VoucherTypeLedger
      types={['PAYMENT', 'REFUND']}
      primaryType="PAYMENT"
      title="Payments"
      description="Money leaving cash or bank, plus refunds returned to a party."
      icon={ArrowUpRight}
      newHref="/dashboard/payments/new"
      newLabel="New payment"
    />
  )
}