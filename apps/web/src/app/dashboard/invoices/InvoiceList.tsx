'use client'

import InvoicesManager from '@/ui/InvoicesManager'

/**
 * The invoice workspace for this route: list, creation, posting and settlement.
 * The shared manager keeps the accounting logic in one place.
 */
export default function InvoiceList() {
  return <InvoicesManager fixedType="ALL" />
}