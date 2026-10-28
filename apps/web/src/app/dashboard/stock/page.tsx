'use client'

import { ArrowLeftRight } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

export default function StockPage() {
  return (
    <VoucherTypeLedger
      types={['STOCK_TRANSFER']}
      primaryType="STOCK_TRANSFER"
      title="Stock Transfers"
      description="Move quantities between locations. Transfers record stock movement, not ledger value."
      icon={ArrowLeftRight}
    />
  )
}