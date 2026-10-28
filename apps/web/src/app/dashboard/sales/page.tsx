'use client'

import { TrendingUp } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

export default function SalesPage() {
  return (
    <VoucherTypeLedger
      types={['SALES_INVOICE']}
      primaryType="SALES_INVOICE"
      title="Sales"
      description="Credit sales raised on invoice, posted against receivables and sales revenue."
      icon={TrendingUp}
      newHref="/dashboard/sales/new"
      newLabel="New sales invoice"
    />
  )
}