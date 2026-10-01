// Parties (customers, suppliers), products, BD-specific fields.
import { pgTable, text, timestamp, varchar, boolean, index, pgEnum } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenant'

export const partyType = pgEnum('party_type', ['CUSTOMER', 'SUPPLIER', 'BOTH'])

export const parties = pgTable('parties', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: partyType('type').notNull(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 200 }),
  bin: varchar('bin', { length: 32 }),                  // e-BIN
  tin: varchar('tin', { length: 32 }),                  // e-TIN
  address: text('address'),
  division: text('division'),
  district: text('district'),
  upazila: text('upazila'),
  // PG18: `union` is a reserved keyword — column is `union_u`.
  union: text('union_u'),
  openingBalance: text('opening_balance').notNull().default('0'),
  active: boolean('active').notNull().default(true),    // U7
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenant: index('parties_tenant_idx').on(t.tenantId),
}))

export const products = pgTable('products', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sku: varchar('sku', { length: 64 }),
  unit: varchar('unit', { length: 16 }),
  hsnCode: varchar('hsn_code', { length: 32 }),
  vatRate: text('vat_rate').notNull().default('15'),
  sdRate: text('sd_rate').notNull().default('0'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueTenantSku: index('products_tenant_sku_idx').on(t.tenantId, t.sku),
}))
