import { VOUCHER_TYPE_PERMISSION, type Permission, type VoucherType } from '@neurobook/shared'

export interface VoucherTypeMeta {
  type: VoucherType
  label: string
  group: string
  hint: string
}

/** Display layer for voucher types: labels and groups shared by every screen. */
export const VOUCHER_CATALOG: VoucherTypeMeta[] = [
  { type: 'SALES_INVOICE', label: 'Sales Invoice', group: 'Sales', hint: 'Goods or services sold on credit.' },
  { type: 'CREDIT_NOTE', label: 'Credit Note', group: 'Sales', hint: 'Sales return or reduction.' },
  { type: 'PURCHASE_INVOICE', label: 'Purchase Invoice', group: 'Purchase', hint: 'Goods or services bought on credit.' },
  { type: 'DEBIT_NOTE', label: 'Debit Note', group: 'Purchase', hint: 'Purchase return or reduction.' },
  { type: 'RECEIPT', label: 'Receipt', group: 'Money', hint: 'Money received into cash or bank.' },
  { type: 'PAYMENT', label: 'Payment', group: 'Money', hint: 'Money paid out of cash or bank.' },
  { type: 'REFUND', label: 'Refund', group: 'Money', hint: 'Money returned to a party.' },
  { type: 'CONTRA', label: 'Contra', group: 'Money', hint: 'Cash and bank moved against each other.' },
  { type: 'JOURNAL', label: 'Journal', group: 'Adjustments', hint: 'Any adjustment that must balance.' },
  { type: 'ADJUSTMENT', label: 'Adjustment', group: 'Adjustments', hint: 'Correction to ledger balances.' },
  { type: 'TRANSFER', label: 'Transfer', group: 'Adjustments', hint: 'Move a balance between ledgers.' },
  { type: 'STOCK_TRANSFER', label: 'Stock Transfer', group: 'Inventory', hint: 'Move stock between locations.' },
]

const LABELS = new Map(VOUCHER_CATALOG.map((v) => [v.type, v.label]))

export function voucherTypeLabel(type: VoucherType | string): string {
  return LABELS.get(type as VoucherType) ?? String(type).replace(/_/g, ' ')
}

/** Every permission that can raise at least one voucher type. */
export const voucherWritePermissions: readonly Permission[] = Array.from(
  new Set(Object.values(VOUCHER_TYPE_PERMISSION)),
)

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  posted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  reversed: 'bg-gray-100 text-gray-600 ring-gray-300',
}

export function voucherStatusBadge(status: string): string {
  return STATUS_BADGE[status] ?? 'bg-gray-100 text-gray-600 ring-gray-300'
}
