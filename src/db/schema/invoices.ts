// Invoices (Phase 3 — Mushak 6.2 sales invoices).
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenant'
import { parties } from './parties'

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => parties.id),
  voucherId: text('voucher_id'),                 // the draft/posted voucher this invoice documents
  date: timestamp('date', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenantDate: index('invoices_tenant_date_idx').on(t.tenantId, t.date),
  byVoucher: index('invoices_voucher_idx').on(t.tenantId, t.voucherId),
}))
