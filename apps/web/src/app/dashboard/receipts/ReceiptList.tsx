'use client'

import { ArrowDownLeft } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

/** Day-book of money received, with its own entry screen. */
export default function ReceiptList() {
  return (
    <VoucherTypeLedger
      types={['RECEIPT']}
      primaryType="RECEIPT"
      title="Receipts"
      description="Money received into cash or bank against a customer receivable."
      icon={ArrowDownLeft}
      newHref="/dashboard/receipts/new"
      newLabel="New receipt"
    />
  )
}