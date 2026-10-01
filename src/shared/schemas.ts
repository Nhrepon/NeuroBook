// Zod schemas. One source of truth for client validation, server validation,
// and the REST contract. Imported by both apps/web and apps/mobile.
import { z } from 'zod'

export const AccountTypeSchema = z.enum([
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
])

export const VoucherStatusSchema = z.enum(['draft', 'posted', 'reversed'])

export const VoucherTypeSchema = z.enum([
  'PAYMENT', 'RECEIPT', 'JOURNAL',
  'SALES_INVOICE', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'CREDIT_NOTE',
  'CONTRA', 'REFUND', 'TRANSFER', 'STOCK_TRANSFER', 'ADJUSTMENT',
])

export const RoleSchema = z.enum([
  'SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER', 'STAFF',
  'SALES', 'AUDITOR', 'USER', 'GUEST', 'VIEWER',
])

export const JournalEntrySchema = z.object({
  accountId: z.string().min(1),
  accountType: AccountTypeSchema,
  debit: z.number().int().nonnegative(),
  credit: z.number().int().nonnegative(),
  reference: z.string().optional(),
}).refine((e) => !(e.debit > 0 && e.credit > 0), {
  message: 'A journal line cannot have both debit and credit',
})

// The base object is exported separately so consumers can `.partial()`,
// `.extend()`, or pick fields without the `.refine()` wrapper (ZodEffects
// does not support those combinators).
export const VoucherDraftObject = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  narration: z.string().min(1).max(500),
  voucherType: VoucherTypeSchema,
  entries: z.array(JournalEntrySchema).min(2),
})

export const VoucherDraftSchema = VoucherDraftObject.refine(
  (v) => v.entries.reduce((s, e) => s + e.debit, 0) ===
         v.entries.reduce((s, e) => s + e.credit, 0),
  { message: 'Debits must equal credits', path: ['entries'] },
)

export const AccountSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  type: AccountTypeSchema,
  parentId: z.string().optional(),
  isGroup: z.boolean().default(false),
  openingBalance: z.number().int().default(0),
  taxApplicable: z.boolean().default(false),
  taxCategory: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxExempt: z.boolean().optional(),
  taxDeductible: z.boolean().optional(),
  taxDeductibleRate: z.number().min(0).max(100).optional(),
  taxExemptRate: z.number().min(0).max(100).optional(),
  taxExemptReason: z.string().optional(),
  taxDeductibleReason: z.string().optional(),
})

export const PartyTypeSchema = z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH'])

export const PartySchema = z.object({
  type: PartyTypeSchema,
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  bin: z.string().max(32).optional(),
  tin: z.string().max(32).optional(),
  address: z.string().max(500).optional(),
  division: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  upazila: z.string().max(100).optional(),
  union: z.string().max(100).optional(),
  openingBalance: z.string().default('0'),
})

export const ProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(64).optional(),
  unit: z.string().max(16).optional(),
  hsnCode: z.string().max(32).optional(),
  vatRate: z.string().default('15'),
  sdRate: z.string().default('0'),
})

// ---------------------------------------------------------------------------
// Period selection. One schema for every period-aware surface: the dashboard
// RSC (searchParams), the report routes, and the REST contract. Parsed with
// `safeParse` at the URL boundary and falling back to the previous period, so
// a hand-edited query string degrades instead of 500ing.
// ---------------------------------------------------------------------------

export const PERIOD_KEYS = ['mtd', 'qtd', 'fy', '30d', 'custom'] as const

export const PeriodKeySchema = z.enum(PERIOD_KEYS)

export const PeriodQuerySchema = z
  .object({
    period: PeriodKeySchema.optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  })
  .refine((v) => v.period !== 'custom' || (!!v.from && !!v.to), {
    message: 'A custom period needs both from and to',
    path: ['period'],
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'from must not be after to',
    path: ['to'],
  })

export type PeriodQuery = z.infer<typeof PeriodQuerySchema>

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  totp: z.string().regex(/^\d{6}$/).optional(),
})

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
})

export const IdempotencyHeaderSchema = z.string().uuid()
