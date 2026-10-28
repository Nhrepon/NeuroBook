'use client'

import { ArrowDownLeft } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

export default function ReceiptsPage() {
  return (
    <VoucherTypeLedger
      types={['RECEIPT']}
      primaryType="RECEIPT"
      title="Receipts"
      description="Money received into cash or bank against a customer receivable."
      icon={ArrowDownLeft}
    />
  )
}