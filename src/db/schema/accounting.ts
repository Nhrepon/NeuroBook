// Chart of accounts, vouchers, journal lines.
// R1 immutability is enforced by a trigger installed in the migration
// (see 0001_initial/up.sql). The repository additionally guards writes.
import {
  pgTable, text, timestamp, integer, varchar, boolean, numeric,
  primaryKey, uniqueIndex, index, pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenant'

export const accountType = pgEnum('account_type', [
  'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
])
export const voucherStatus = pgEnum('voucher_status', ['draft', 'posted', 'reversed'])
export const voucherType = pgEnum('voucher_type', [
  'PAYMENT', 'RECEIPT', 'JOURNAL',
  'SALES_INVOICE', 'PURCHASE_INVOICE',
  'DEBIT_NOTE', 'CREDIT_NOTE',
  'CONTRA', 'REFUND', 'TRANSFER', 'STOCK_TRANSFER', 'ADJUSTMENT',
])

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  type: accountType('type').notNull(),
  parentId: text('parent_id'),
  isGroup: boolean('is_group').notNull().default(false),
  openingBalance: integer('opening_balance').notNull().default(0),  // minor units (R7)
  taxApplicable: boolean('tax_applicable').notNull().default(false),
  taxCategory: text('tax_category'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }),
  taxExempt: boolean('tax_exempt').default(false),
  taxDeductible: boolean('tax_deductible').default(false),
  taxDeductibleRate: numeric('tax_deductible_rate', { precision: 5, scale: 2 }),
  taxExemptRate: numeric('tax_exempt_rate', { precision: 5, scale: 2 }),
  taxExemptReason: text('tax_exempt_reason'),
  taxDeductibleReason: text('tax_deductible_reason'),
  active: boolean('active').notNull().default(true),         // U7: deactivated, not removed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueTenantCode: uniqueIndex('accounts_tenant_code_uq').on(t.tenantId, t.code),
  byType: index('accounts_tenant_type_idx').on(t.tenantId, t.type),
}))

export const vouchers = pgTable('vouchers', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherType: voucherType('voucher_type').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  narration: text('narration').notNull(),
  status: voucherStatus('status').notNull().default('draft'),
  totalDebit: integer('total_debit').notNull().default(0),
  totalCredit: integer('total_credit').notNull().default(0),
  sequenceNumber: varchar('sequence_number', { length: 50 }),    // gapless (R3)
  fiscalPeriodLabel: text('fiscal_period_label'),
  reversedById: text('reversed_by_id'),                            // link to reversal
  reversesId: text('reverses_id'),                                // this voucher reverses…
  idempotencyKey: varchar('idempotency_key', { length: 64 }),
  version: integer('version').notNull().default(1),                // R5
  createdBy: text('created_by').notNull(),
  postedBy: text('posted_by'),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenantDate: index('vouchers_tenant_date_idx').on(t.tenantId, t.date),
  byTenantStatus: index('vouchers_tenant_status_idx').on(t.tenantId, t.status),
  byTenantSequence: index('vouchers_tenant_sequence_idx').on(t.tenantId, t.sequenceNumber),
  // R6: idempotency key is unique per tenant.
  uniqueIdempotency: uniqueIndex('vouchers_tenant_idem_uq').on(t.tenantId, t.idempotencyKey),
}))

export const journalLines = pgTable('journal_lines', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherId: text('voucher_id').notNull().references(() => vouchers.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  accountType: accountType('account_type').notNull(),
  debit: integer('debit').notNull().default(0),     // minor units (R7)
  credit: integer('credit').notNull().default(0),    // minor units (R7)
  reference: text('reference'),
  lineOrder: integer('line_order').notNull().default(0),
}, (t) => ({
  byVoucher: index('journal_lines_voucher_idx').on(t.tenantId, t.voucherId),
  byAccount: index('journal_lines_account_idx').on(t.tenantId, t.accountId),
}))

// R6: idempotency record — same key returns the original response within 24h.
export const idempotencyKeys = pgTable('idempotency_keys', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 64 }).notNull(),
  voucherId: text('voucher_id').references(() => vouchers.id),
  responseJson: text('response_json').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.key] }),
}))
