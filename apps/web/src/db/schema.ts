import { pgTable, text, timestamp, integer, uuid, varchar, boolean, jsonb, uniqueIndex, index, check, foreignKey } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  /**
   * Company password, checked when a session switches into this tenant. Separate
   * from any person's login password: it belongs to the company, not the user.
   * Null until an admin sets one in Settings.
   */
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 32 }).notNull().default('VIEWER'),
  active: boolean('active').notNull().default(true),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqEmail: uniqueIndex('users_tenant_email_idx').on(t.tenantId, t.email),
  roleCheck: check('users_role_check', sql`${t.role} IN ('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES', 'PURCHASER', 'CASHIER', 'STORE_KEEPER', 'AUDITOR', 'VIEWER')`),
}))

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ip: text('ip'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
}))

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  parentId: uuid('parent_id'),
  isGroup: boolean('is_group').notNull().default(false),
  openingBalance: integer('opening_balance').notNull().default(0),
  taxApplicable: boolean('tax_applicable').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  codeUniq: uniqueIndex('accounts_tenant_code_idx').on(t.tenantId, t.code),
  typeCheck: check('accounts_type_check', sql`${t.type} IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')`),
  parentFk: foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete('set null'),
}))

export const fiscalPeriods = pgTable('fiscal_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 32 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex('fp_tenant_label_idx').on(t.tenantId, t.label),
  statusCheck: check('fp_status_check', sql`${t.status} IN ('open','closed')`),
}))

export const voucherSequences = pgTable('voucher_sequences', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherType: varchar('voucher_type', { length: 32 }).notNull(),
  fiscalYearLabel: varchar('fiscal_year_label', { length: 32 }).notNull(),
  lastNumber: integer('last_number').notNull().default(0),
}, (t) => ({
  uniq: uniqueIndex('vs_tenant_type_year_idx').on(t.tenantId, t.voucherType, t.fiscalYearLabel),
  lastNumberCheck: check('vs_last_number_check', sql`${t.lastNumber} >= 0`),
}))

export const vouchers = pgTable('vouchers', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  narration: text('narration').notNull(),
  voucherType: varchar('voucher_type', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  version: integer('version').notNull().default(1),
  idempotencyKey: varchar('idempotency_key', { length: 128 }),
  sequenceNumber: varchar('sequence_number', { length: 64 }),
  reversedById: uuid('reversed_by_id'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  postedBy: uuid('posted_by').references(() => users.id, { onDelete: 'set null' }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  statusCheck: check('vouchers_status_check', sql`${t.status} IN ('draft','posted','reversed')`),
  tenantDateIdx: index('vouchers_tenant_date_idx').on(t.tenantId, t.date),
}))

export const journalLines = pgTable('journal_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherId: uuid('voucher_id').notNull().references(() => vouchers.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  accountType: varchar('account_type', { length: 16 }).notNull(),
  debit: integer('debit').notNull().default(0),
  credit: integer('credit').notNull().default(0),
  reference: text('reference'),
}, (t) => ({
  amountsCheck: check('jl_amounts_check', sql`${t.debit} >= 0 AND ${t.credit} >= 0 AND NOT (${t.debit} > 0 AND ${t.credit} > 0)`),
  voucherIdx: index('jl_voucher_idx').on(t.voucherId),
  accountIdx: index('jl_account_idx').on(t.accountId),
}))

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 128 }).notNull(),
  response: jsonb('response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: uniqueIndex('idem_tenant_key_idx').on(t.tenantId, t.key),
}))

export const parties = pgTable('parties', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: varchar('type', { length: 16 }).notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  typeCheck: check('parties_type_check', sql`${t.type} IN ('CUSTOMER','SUPPLIER','BOTH')`),
}))

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: varchar('sku', { length: 64 }),
  unit: text('unit'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => parties.id, { onDelete: 'set null' }),
  number: varchar('number', { length: 64 }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  total: integer('total').notNull().default(0),
  vat: integer('vat').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  statusCheck: check('invoices_status_check', sql`${t.status} IN ('draft','sent','paid','cancelled')`),
}))

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  vatRate: integer('vat_rate').notNull().default(0),
  vatAmount: integer('vat_amount').notNull().default(0),
  sdRate: integer('sd_rate').notNull().default(0),
  sdAmount: integer('sd_amount').notNull().default(0),
  total: integer('total').notNull().default(0),
}, (t) => ({
  invoiceIdx: index('il_invoice_idx').on(t.invoiceId),
}))

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
  partyId: uuid('party_id').references(() => parties.id, { onDelete: 'set null' }),
  amount: integer('amount').notNull(),
  method: varchar('method', { length: 32 }).notNull().default('cash'),
  reference: text('reference'),
  paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  accountNumber: text('account_number'),
  bankName: text('bank_name'),
  currency: varchar('currency', { length: 8 }).notNull().default('BDT'),
  openingBalance: integer('opening_balance').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const bankTransactions = pgTable('bank_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  description: text('description'),
  amount: integer('amount').notNull(),
  type: varchar('type', { length: 8 }).notNull(),
  matchedVoucherId: uuid('matched_voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
  reconciled: boolean('reconciled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  typeCheck: check('bt_type_check', sql`${t.type} IN ('debit','credit')`),
}))

export const taxRates = pgTable('tax_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  rate: integer('rate').notNull(), // basis points (1500 = 15.00%)
  kind: varchar('kind', { length: 16 }).notNull().default('vat'),
  active: boolean('active').notNull().default(true),
})

export const companySettings = pgTable('company_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),
  companyName: text('company_name').notNull(),
  binNumber: text('bin_number'),
  tinNumber: text('tin_number'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(7),
  currency: varchar('currency', { length: 8 }).notNull().default('BDT'),
  logoUrl: text('logo_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: varchar('code', { length: 32 }),
  active: boolean('active').notNull().default(true),
})

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  voucherId: uuid('voucher_id').references(() => vouchers.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  unitCost: integer('unit_cost').notNull().default(0),
  type: varchar('type', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  typeCheck: check('sm_type_check', sql`${t.type} IN ('in','out','transfer','adjustment')`),
}))
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  ip: text('ip'),
  /** The role the actor held when it wrote this row — a snapshot, so a later role change does not rewrite history. */
  actorRole: varchar('actor_role', { length: 32 }),
  /** Browser / device as reported by the client, for "where did this come from". */
  userAgent: text('user_agent'),
  /** `POST /api/v1/vouchers`: the endpoint that performed the write. */
  route: text('route'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  tenantIdx: index('audit_tenant_idx').on(t.tenantId, t.createdAt),
}))
