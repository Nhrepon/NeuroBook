// Users, sessions, audit log. R11/R13/R15.
import {
  pgTable, text, timestamp, varchar, boolean, jsonb, index, primaryKey, uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenant'
import { RoleSchema, type Role } from '@neurobook/shared'

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 200 }).notNull(),
  passwordHash: text('password_hash').notNull(),  // Argon2id (R11)
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  fullName: text('full_name'),
  role: text('role').$type<Role>().notNull().default('USER'),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueTenantEmail: uniqueIndex('users_tenant_email_uq').on(t.tenantId, t.email),
}))

// R13: revocable refresh-token sessions. Server-side row; logout deletes the row.
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  userAgent: text('user_agent'),
  ip: varchar('ip', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('sessions_user_idx').on(t.userId),
}))

// R15: append-only audit log. Every mutation.
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id'),
  ip: varchar('ip', { length: 64 }),
  action: text('action').notNull(),          // e.g. "voucher.post"
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTenantCreated: index('audit_log_tenant_created_idx').on(t.tenantId, t.createdAt),
  byResource: index('audit_log_resource_idx').on(t.tenantId, t.resourceType, t.resourceId),
}))

export { RoleSchema }
