/**
 * Tenant, users and sessions (§5.1, §5.2, §15.2).
 *
 * Every tenant-scoped table carries `tenantId`; RLS is the authoritative
 * isolation mechanism (R9) and the app-layer filter is defence-in-depth.
 */
import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/** §5.2 roles. */
export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "ADMIN",
  "ACCOUNTANT",
  "MANAGER",
  "STAFF",
  "SALES",
  "AUDITOR",
  "USER",
  "GUEST",
  "VIEWER",
]);

export const tenants = pgTable("tenants", {
  id: varchar("id", { length: 26 }).primaryKey(), // ULID
  name: text("name").notNull(),
  /** Bangladesh Business Identification Number. */
  bin: text("bin"),
  tin: text("tin"),
  /** e-BIN / e-TIN validation status from the NBR API (Phase 3). */
  binVerified: boolean("bin_verified").default(false).notNull(),
  /** Base currency; taka for BD tenants. Multi-currency is Phase 4. */
  baseCurrency: varchar("base_currency", { length: 3 }).default("BDT").notNull(),
  /** Fiscal year runs 1 Jul – 30 Jun by default. */
  fiscalYearStartMonth: integer("fiscal_year_start_month").default(7).notNull(),
  locale: varchar("locale", { length: 5 }).default("en").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 26 }).primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  /** Argon2id hash (R11). Never stored or logged in plaintext. */
  passwordHash: text("password_hash"),
  /** TOTP secret, encrypted at rest (R16). Set when 2FA is enrolled. */
  totpSecret: text("totp_secret"),
  totpEnrolled: boolean("totp_enrolled").default(false).notNull(),
  /** §15.2 R12: 2FA is required for ADMIN and SUPER_ADMIN. */
  twoFactorRequired: boolean("two_factor_required").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** A user may belong to several tenants with a different role in each. */
export const userTenants = pgTable(
  "user_tenants",
  {
    userId: varchar("user_id", { length: 26 }).notNull(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    role: roleEnum("role").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tenantId] })],
);

/**
 * Revocable refresh-token session (R13).
 *
 * Refresh tokens are server-side rows, so logout or a credential change can
 * invalidate them immediately; access tokens stay short-lived (15 min).
 */
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 26 }).primaryKey(),
  userId: varchar("user_id", { length: 26 }).notNull(),
  tenantId: varchar("tenant_id", { length: 26 }),
  /** Hashed refresh token; the raw value is only ever held by the client. */
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("sessions_refresh_token_hash_idx").on(t.refreshTokenHash)]);

export const tenantsRelations = relations(tenants, ({ many }) => ({
  userTenants: many(userTenants),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userTenants: many(userTenants),
  sessions: many(sessions),
}));

export const userTenantsRelations = relations(userTenants, ({ one }) => ({
  user: one(users, { fields: [userTenants.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [userTenants.tenantId], references: [tenants.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export { bigint };
