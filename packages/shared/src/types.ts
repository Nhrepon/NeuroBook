export type VoucherStatus = 'draft' | 'posted' | 'reversed'
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
export type VoucherType =
  | 'PAYMENT' | 'RECEIPT' | 'JOURNAL' | 'SALES_INVOICE' | 'PURCHASE_INVOICE'
  | 'DEBIT_NOTE' | 'CREDIT_NOTE' | 'CONTRA' | 'REFUND' | 'TRANSFER'
  | 'STOCK_TRANSFER' | 'ADJUSTMENT'

export interface JournalEntry {
  accountId: string
  accountType: AccountType
  debit: number
  credit: number
  reference?: string
}

export interface Voucher {
  id: string
  tenantId: string
  date: string
  narration: string
  voucherType: VoucherType
  entries: JournalEntry[]
  totalDebit: number
  totalCredit: number
  status: VoucherStatus
  version: number
  idempotencyKey?: string
  sequenceNumber?: string
  reversedById?: string
}
