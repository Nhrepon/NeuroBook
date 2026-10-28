'use client'

import { ShoppingCart } from 'lucide-react'
import VoucherTypeLedger from '@/ui/VoucherTypeLedger'

export default function PurchasesPage() {
  return (
    <VoucherTypeLedger
      types={['PURCHASE_INVOICE']}
      primaryType="PURCHASE_INVOICE"
      title="Purchases"
      description="Supplier bills received on credit, posted against payables and expense or inventory."
      icon={ShoppingCart}
      newHref="/dashboard/purchases/new"
      newLabel="New purchase invoice"
    />
  )
}