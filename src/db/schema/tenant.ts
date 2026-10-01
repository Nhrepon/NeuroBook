// Tenants, fiscal periods (R2), voucher sequences (R3).
import { pgTable, text, timestamp, varchar, integer, primaryKey, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const fiscalPeriodStatus = pgEnum('fiscal_period_status', ['open', 'closed'])

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  bin: varchar('bin', { length: 32 }),                // e-BIN (NBR)
  tin: varchar('tin', { length: 32 }),                // e-TIN
  address: text('address'),
  division: text('division'),
  district: text('district'),
  upazila: text('upazila'),
  // PG18: `union` is a reserved keyword — column is `union_u`.
  union: text('union_u'),
  roundingAccountId: text('rounding_account_id'),    // R7
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const fiscalPeriods = pgTable('fiscal_periods', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),         // "FY 2025-26"
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: fiscalPeriodStatus('status').notNull().default('open'),
  closedBy: text('closed_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  reopenedBy: text('reopened_by'),
  reopenedAt: timestamp('reopened_at', { withTimezone: true }),
}, (t) => ({
  uniqueTenantLabel: uniqueIndex('fiscal_periods_tenant_label_uq').on(t.tenantId, t.label),
}))

// R3: gapless, legal sequence numbers. Incremented via SELECT … FOR UPDATE
// inside the post transaction. A Postgres SEQUENCE would consume a number
// on rollback, which is exactly the bug we are avoiding.
export const voucherSequences = pgTable('voucher_sequences', {
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherType: text('voucher_type').notNull(),
  fiscalYearLabel: text('fiscal_year_label').notNull(),
  lastNumber: integer('last_number').notNull().default(0),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.voucherType, t.fiscalYearLabel] }),
}))
