/**
 * Accounting schema — the tables §15.1 R1–R8 are enforced against.
 *
 * Money is integer minor units throughout (R7): every amount column is
 * bigint or integer. There are no numeric/double-precision money columns by
 * construction, and drizzle-kit `strict` mode catches drift.
 */
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenants } from "./tenant.js";

export const accountTypeEnum = pgEnum("account_type", [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const voucherTypeEnum = pgEnum("voucher_type", [
  "PAYMENT",
  "RECEIPT",
  "JOURNAL",
  "SALES",
  "PURCHASE",
  "DEBIT_NOTE",
  "CREDIT_NOTE",
  "CONTRA",
  "REFUND",
  "TRANSFER",
  "STOCK_TRANSFER",
  "ADJUSTMENT",
]);

export const voucherStatusEnum = pgEnum("voucher_status", ["draft", "posted", "reversed"]);

/**
 * Chart of accounts (§4.2). Groups hold children, posting accounts hold
 * balances. Codes are the user-facing identifier and are unique per tenant.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    type: accountTypeEnum("type").notNull(),
    parentId: varchar("parent_id", { length: 26 }),
    isGroup: boolean("is_group").default(false).notNull(),
    /** Opening balance in minor units, signed toward the normal side. */
    openingBalance: bigint("opening_balance", { mode: "number" }).default(0).notNull(),
    taxApplicable: boolean("tax_applicable").default(false).notNull(),
    taxCategory: text("tax_category"),
    /** Rate in basis points: 15% === 1500, 7.5% === 750. */
    taxRate: integer("tax_rate"),
    taxExempt: boolean("tax_exempt"),
    taxDeductible: boolean("tax_deductible"),
    taxDeductibleRate: integer("tax_deductible_rate"),
    taxExemptRate: integer("tax_exempt_rate"),
    taxExemptReason: text("tax_exempt_reason"),
    taxDeductibleReason: text("tax_deductible_reason"),
    /** A deactivated account is hidden from new entries but kept for history (U7). */
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    /** R5 optimistic concurrency. */
    version: integer("version").default(1).notNull(),
  },
  (t) => [
    uniqueIndex("accounts_tenant_code_idx").on(t.tenantId, t.code),
    // R7: an opening balance is a money column and cannot be negative.
    check("accounts_opening_balance_nonnegative", sql`${t.openingBalance} >= 0`),
  ],
);

/**
 * §15.1 R2: posting into a closed period is rejected. Only SUPER_ADMIN may
 * reopen, and reopening is itself audit-logged.
 */
export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    name: text("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: pgEnum("period_status", ["open", "closed"])("status").default("open").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: varchar("closed_by", { length: 26 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("fiscal_periods_tenant_range_idx").on(t.tenantId, t.startDate, t.endDate)],
);

/**
 * §15.1 R3: gapless, legal sequence numbers for Mushak/e-invoice.
 *
 * Incremented via `SELECT ... FOR UPDATE` inside the same transaction as the
 * post (R8). A Postgres SEQUENCE is deliberately NOT used: a rolled-back
 * transaction still consumes a sequence value, which would break the gapless
 * requirement. Voided numbers are consumed and never reused.
 */
export const voucherSequences = pgTable(
  "voucher_sequences",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    voucherType: voucherTypeEnum("voucher_type").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    lastNumber: bigint("last_number", { mode: "number" }).default(0).notNull(),
    prefix: text("prefix"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("voucher_sequences_tenant_type_year_idx").on(
      t.tenantId,
      t.voucherType,
      t.fiscalYear,
    ),
  ],
);

/**
 * The voucher header. `version` drives R5 optimistic concurrency; the status
 * transitions draft → posted → reversed are the only permitted writes, and a
 * posted row is immutable except for the reversal transition (R1, enforced by
 * trigger in migrations/).
 */
export const vouchers = pgTable(
  "vouchers",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    /** Assigned at post, never at draft. */
    sequenceNumber: text("sequence_number"),
    voucherType: voucherTypeEnum("voucher_type").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    narration: text("narration").notNull(),
    status: voucherStatusEnum("status").default("draft").notNull(),
    /** Σ entry debits; recomputed by trigger (R4). */
    totalDebit: bigint("total_debit", { mode: "number" }).default(0).notNull(),
    /** Σ entry credits; recomputed by trigger (R4). */
    totalCredit: bigint("total_credit", { mode: "number" }).default(0).notNull(),
    /** §15.1 R6. */
    idempotencyKey: text("idempotency_key"),
    /** The voucher that reversed this one (R1). */
    reversedById: varchar("reversed_by_id", { length: 26 }),
    version: integer("version").default(1).notNull(),
    createdBy: varchar("created_by", { length: 26 }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("vouchers_idempotency_idx").on(t.tenantId, t.idempotencyKey),
    uniqueIndex("vouchers_tenant_sequence_idx").on(t.tenantId, t.voucherType, t.sequenceNumber),
    // R4: totals must always agree, even before the trigger recomputes them.
    check("vouchers_totals_balanced", sql`${t.totalDebit} = ${t.totalCredit}`),
    check("vouchers_total_debit_nonnegative", sql`${t.totalDebit} >= 0`),
    check("vouchers_total_credit_nonnegative", sql`${t.totalCredit} >= 0`),
  ],
);

/**
 * Journal lines. Exactly one of debit/credit is non-zero, enforced by CHECK;
 * the recomputing trigger asserts the sum over these rows equals the header
 * totals, which is what actually keeps the ledger footing (R4).
 */
export const voucherEntries = pgTable(
  "voucher_entries",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    voucherId: varchar("voucher_id", { length: 26 }).notNull(),
    accountId: varchar("account_id", { length: 26 }).notNull(),
    debit: bigint("debit", { mode: "number" }).default(0).notNull(),
    credit: bigint("credit", { mode: "number" }).default(0).notNull(),
    reference: text("reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Plain join index, NOT unique: a voucher carries as many lines as it
    // needs. A unique index here would cap every voucher at one journal line.
    index("voucher_entries_voucher_idx").on(t.voucherId),
    // R4 line-level invariant: exactly one side non-negative-and-nonzero.
    check(
      "voucher_entries_exactly_one_side",
      sql`(${t.debit} > 0 AND ${t.credit} = 0) OR (${t.credit} > 0 AND ${t.debit} = 0)`,
    ),
    check("voucher_entries_debit_nonnegative", sql`${t.debit} >= 0`),
    check("voucher_entries_credit_nonnegative", sql`${t.credit} >= 0`),
  ],
);

/**
 * §15.1 R6 dedupe store. A replay within the TTL returns the original
 * response instead of a second posting.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    key: text("key").notNull(),
    /** Stored response body, replayed verbatim on a retry. */
    response: jsonb("response"),
    statusCode: integer("status_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] })],
);

/**
 * §15.2 R15: append-only audit. Every mutation records user, tenant, IP and a
 * before/after diff. No UPDATE/DELETE path exists for this table.
 */
export const auditLog = pgTable("audit_log", {
  id: varchar("id", { length: 26 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 26 }).notNull(),
  userId: varchar("user_id", { length: 26 }),
  action: text("action").notNull(),
  /** "vouchers" | "accounts" | ... */
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id", { length: 26 }),
  ip: text("ip"),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [accounts.tenantId], references: [tenants.id] }),
  parent: one(accounts, { fields: [accounts.parentId], references: [accounts.id] }),
  entries: many(voucherEntries),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [vouchers.tenantId], references: [tenants.id] }),
  entries: many(voucherEntries),
  reversedBy: one(vouchers, { fields: [vouchers.reversedById], references: [vouchers.id] }),
}));

export const voucherEntriesRelations = relations(voucherEntries, ({ one }) => ({
  voucher: one(vouchers, { fields: [voucherEntries.voucherId], references: [vouchers.id] }),
  account: one(accounts, { fields: [voucherEntries.accountId], references: [accounts.id] }),
}));

export const fiscalPeriodsRelations = relations(fiscalPeriods, ({ one }) => ({
  tenant: one(tenants, { fields: [fiscalPeriods.tenantId], references: [tenants.id] }),
}));
