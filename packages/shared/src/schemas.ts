import { z } from 'zod'

export const MinorUnitsSchema = z.number().int().nonnegative()

export const AccountTypeSchema = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])

export const JournalEntrySchema = z.object({
  accountId: z.string().uuid(),
  accountType: AccountTypeSchema,
  debit: MinorUnitsSchema,
  credit: MinorUnitsSchema,
  reference: z.string().optional(),
})

export const VoucherTypeSchema = z.enum([
  'PAYMENT', 'RECEIPT', 'JOURNAL', 'SALES_INVOICE', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'CREDIT_NOTE', 'CONTRA', 'REFUND', 'TRANSFER',
  'STOCK_TRANSFER', 'ADJUSTMENT',
])

export const VoucherStatusSchema = z.enum(['draft', 'posted', 'reversed'])
