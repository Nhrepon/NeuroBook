'use client'

import { ArrowUpRight } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

export default function PaymentsPage() {
  return (
    <VoucherTypeLedger
      types={['PAYMENT', 'REFUND']}
      primaryType="PAYMENT"
      title="Payments"
      description="Money leaving cash or bank, plus refunds returned to a party."
      icon={ArrowUpRight}
    />
  )
}