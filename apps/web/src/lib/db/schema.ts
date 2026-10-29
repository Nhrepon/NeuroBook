import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timeStamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    tenantCode: varchar("code", { length: 64 }).notNull(),
    legalName: text("legal_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    district: text("district"),
    postalCode: text("postal_code"),
    country: varchar("country", { length: 2 }).notNull().default("BD"),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Asia/Dhaka"),
    locale: varchar("locale", { length: 8 }).notNull().default("en"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    passwordHash: text("password_hash"),
    ...timeStamps(),
  },
  (t) => ({
    codeUniq: uniqueIndex("tenants_code_uniq").on(t.tenantCode),
    statusCheck: check(
      "tenants_status_check",
      sql`${t.status} IN ('active','suspended','archived')`,
    ),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 32 }).notNull().default("VIEWER"),
    active: boolean("active").notNull().default(true),
    /** Bumped on credential/access change to invalidate live tokens early. */
    tokenVersion: integer("token_version").notNull().default(0),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    ...timeStamps(),
  },
  (t) => ({
    uniqEmail: uniqueIndex("users_tenant_email_idx").on(
      t.tenantId,
      sql`lower(${t.email})`,
    ),
    tenantIdx: index("users_tenant_idx").on(t.tenantId),
    roleCheck: check(
      "users_role_check",
      sql`${t.role} IN ('ADMIN', 'MANAGER', 'ACCOUNTANT', 'SALES', 'PURCHASER', 'CASHIER', 'STORE_KEEPER', 'AUDITOR', 'VIEWER')`,
    ),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    ...timeStamps(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    tenantIdx: index("sessions_tenant_idx").on(t.tenantId),
    refreshUniq: uniqueIndex("sessions_refresh_idx").on(t.refreshTokenHash),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    parentId: uuid("parent_id"),
    isGroup: boolean("is_group").notNull().default(false),
    openingBalance: bigint("opening_balance", { mode: "number" })
      .notNull()
      .default(0),
    taxApplicable: boolean("tax_applicable").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    codeUniq: uniqueIndex("accounts_tenant_code_idx").on(t.tenantId, t.code),
    tenantIdx: index("accounts_tenant_idx").on(t.tenantId),
    parentIdx: index("accounts_parent_idx").on(t.parentId),
    typeCheck: check(
      "accounts_type_check",
      sql`${t.type} IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')`,
    ),
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "accounts_parent_fk",
    }).onDelete("restrict"),
  }),
);

export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 32 }).notNull(),
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    ...timeStamps(),
  },
  (t) => ({
    uniq: uniqueIndex("fp_tenant_label_idx").on(t.tenantId, t.label),
    tenantIdx: index("fp_tenant_idx").on(t.tenantId),
    statusCheck: check(
      "fp_status_check",
      sql`${t.status} IN ('open','closed')`,
    ),
    dateOrderCheck: check(
      "fp_date_order_check",
      sql`${t.endDate} > ${t.startDate}`,
    ),
  }),
);

export const voucherSequences = pgTable(
  "voucher_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    voucherType: varchar("voucher_type", { length: 32 }).notNull(),
    fiscalYearLabel: varchar("fiscal_year_label", { length: 32 }).notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => ({
    uniq: uniqueIndex("vs_tenant_type_year_idx").on(
      t.tenantId,
      t.voucherType,
      t.fiscalYearLabel,
    ),
    lastNumberCheck: check("vs_last_number_check", sql`${t.lastNumber} >= 0`),
  }),
);

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fiscalPeriodId: uuid("fiscal_period_id").references(
      () => fiscalPeriods.id,
      { onDelete: "set null" },
    ),
    date: date("date", { mode: "date" }).notNull(),
    narration: text("narration").notNull(),
    voucherType: varchar("voucher_type", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    version: integer("version").notNull().default(1),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    sequenceNumber: varchar("sequence_number", { length: 64 }),
    /** The voucher this one reverses (set on the reversal, points at the original). */
    reversesId: uuid("reverses_id"),
    /** The reversal that reverses this one (set on the original). */
    reversedById: uuid("reversed_by_id"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    ...timeStamps(),
  },
  (t) => ({
    statusCheck: check(
      "vouchers_status_check",
      sql`${t.status} IN ('draft','posted','reversed')`,
    ),
    // A posted voucher must carry its number and the moment it was posted.
    postedCheck: check(
      "vouchers_posted_check",
      sql`${t.status} <> 'posted' OR (${t.postedAt} IS NOT NULL AND ${t.sequenceNumber} IS NOT NULL)`,
    ),
    tenantDateIdx: index("vouchers_tenant_date_idx").on(t.tenantId, t.date),
    typeDateIdx: index("vouchers_tenant_type_date_idx").on(
      t.tenantId,
      t.voucherType,
      t.date,
    ),
    fiscalPeriodIdx: index("vouchers_fiscal_period_idx").on(
      t.tenantId,
      t.fiscalPeriodId,
    ),
    seqUniq: uniqueIndex("vouchers_tenant_seq_idx")
      .on(t.tenantId, t.sequenceNumber)
      .where(sql`${t.sequenceNumber} IS NOT NULL`),
    idemUniq: uniqueIndex("vouchers_tenant_idem_idx")
      .on(t.tenantId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    // A voucher can be reversed at most once, and a reversal targets one original.
    reversedByUniq: uniqueIndex("vouchers_reversed_by_idx")
      .on(t.reversedById)
      .where(sql`${t.reversedById} IS NOT NULL`),
    reversedByFk: foreignKey({
      columns: [t.reversedById],
      foreignColumns: [t.id],
      name: "vouchers_reversed_by_fk",
    }).onDelete("restrict"),
    reversesUniq: uniqueIndex("vouchers_reverses_idx")
      .on(t.reversesId)
      .where(sql`${t.reversesId} IS NOT NULL`),
    reversesFk: foreignKey({
      columns: [t.reversesId],
      foreignColumns: [t.id],
      name: "vouchers_reverses_fk",
    }).onDelete("restrict"),
  }),
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "restrict" }),
    accountId: uuid("account_id").notNull(),
    accountType: varchar("account_type", { length: 16 }).notNull(),
    debit: bigint("debit", { mode: "number" }).notNull().default(0),
    credit: bigint("credit", { mode: "number" }).notNull().default(0),
    reference: text("reference"),
  },
  (t) => ({
    amountsCheck: check(
      "jl_amounts_check",
      sql`${t.debit} >= 0 AND ${t.credit} >= 0 AND ((${t.debit} > 0) <> (${t.credit} > 0))`,
    ),
    voucherIdx: index("jl_voucher_idx").on(t.voucherId),
    accountIdx: index("jl_account_idx").on(t.accountId),
    ledgerIdx: index("jl_tenant_account_idx").on(t.tenantId, t.accountId),
    accountFk: foreignKey({
      columns: [t.accountId],
      foreignColumns: [accounts.id],
      name: "jl_account_fk",
    }).onDelete("restrict"),
  }),
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 128 }).notNull(),
    response: jsonb("response"),
    ...timeStamps(),
  },
  (t) => ({
    uniq: uniqueIndex("idem_tenant_key_idx").on(t.tenantId, t.key),
    createdIdx: index("idem_created_idx").on(t.createdAt),
  }),
);

export const parties = pgTable(
  "parties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    typeCheck: check(
      "parties_type_check",
      sql`${t.type} IN ('CUSTOMER','SUPPLIER','BOTH')`,
    ),
    tenantTypeIdx: index("parties_tenant_type_idx").on(t.tenantId, t.type),
  }),
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Short company code, e.g. PACE or PACE-SC. Unique per company when set. */
    code: varchar("code", { length: 32 }),
    description: text("description"),
    /** Parent category for grouped taxonomies (Pacemaker -> Single chamber). */
    parentId: uuid("parent_id"),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    nameUnique: uniqueIndex("categories_tenant_name_uidx").on(
      t.tenantId,
      sql`lower(${t.name})`,
    ),
    codeUniq: uniqueIndex("categories_tenant_code_uidx")
      .on(t.tenantId, sql`lower(${t.code})`)
      .where(sql`${t.code} IS NOT NULL`),
    tenantIdx: index("categories_tenant_idx").on(t.tenantId),
    parentIdx: index("categories_parent_idx").on(t.tenantId, t.parentId),
    // Deleting a parent promotes its children to the top level instead of
    // erasing them; products keep their category.
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "categories_parent_fk",
    }).onDelete("set null"),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Optional Bangla name for bilingual documents. */
    nameBn: text("name_bn"),
    /** Short human code (searchable); distinct from SKUs and the barcode. */
    code: varchar("code", { length: 32 }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    /** Default unit price (excluding VAT), in minor units. */
    price: bigint("price", { mode: "number" }).notNull().default(0),
    /** Default purchase cost, in minor units (for margin and stock valuation). */
    costPrice: bigint("cost_price", { mode: "number" }).notNull().default(0),
    /** On-hand level at or below which the product is flagged for restocking. */
    reorderLevel: numeric("reorder_level", {
      precision: 18,
      scale: 4,
      mode: "number",
    })
      .notNull()
      .default(0),
    unit: text("unit"),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    codeUniq: uniqueIndex("products_tenant_code_idx")
      .on(t.tenantId, t.code)
      .where(sql`${t.code} IS NOT NULL`),
    tenantIdx: index("products_tenant_idx").on(t.tenantId),
    categoryIdx: index("products_category_idx").on(t.categoryId),
    priceCheck: check("products_price_check", sql`${t.price} >= 0`),
    costCheck: check("products_cost_check", sql`${t.costPrice} >= 0`),
    reorderCheck: check("products_reorder_check", sql`${t.reorderLevel} >= 0`),
  }),
);

export const productSkus = pgTable(
  "product_skus",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    /** Scanner barcode; unique per company when present. */
    barcode: varchar("barcode", { length: 64 }),
    ...timeStamps(),
  },
  (t) => ({
    skuUnique: uniqueIndex("product_skus_tenant_sku_uidx").on(
      t.tenantId,
      t.sku,
    ),
    barcodeUnique: uniqueIndex("product_skus_tenant_barcode_uidx")
      .on(t.tenantId, t.barcode)
      .where(sql`${t.barcode} IS NOT NULL`),
    productIdx: index("product_skus_product_idx").on(t.productId),
  }),
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => parties.id, {
      onDelete: "set null",
    }),
    /** 'sale' (customer invoice) or 'purchase' (supplier bill). */
    type: varchar("type", { length: 16 }).notNull().default("sale"),
    number: varchar("number", { length: 64 }),
    date: date("date", { mode: "date" }).notNull(),
    /** Net of VAT and any supplementary duty. */
    subtotal: bigint("subtotal", { mode: "number" }).notNull().default(0),
    vat: bigint("vat", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    /** Payment due date and terms, for ageing and reminders. */
    dueDate: date("due_date", { mode: "date" }),
    paymentTerms: integer("payment_terms"),
    notes: text("notes"),
    ...timeStamps(),
  },
  (t) => ({
    statusCheck: check(
      "invoices_status_check",
      sql`${t.status} IN ('draft','sent','partially_paid','paid','cancelled')`,
    ),
    typeCheck: check(
      "invoices_type_check",
      sql`${t.type} IN ('sale','purchase')`,
    ),
    totalCheck: check("invoices_total_check", sql`${t.total} >= 0`),
    subtotalCheck: check("invoices_subtotal_check", sql`${t.subtotal} >= 0`),
    vatCheck: check("invoices_vat_check", sql`${t.vat} >= 0`),
    dueDateCheck: check(
      "invoices_due_date_check",
      sql`${t.dueDate} IS NULL OR ${t.dueDate} >= ${t.date}`,
    ),
    termsCheck: check(
      "invoices_terms_check",
      sql`${t.paymentTerms} IS NULL OR ${t.paymentTerms} >= 0`,
    ),
    numberUniq: uniqueIndex("invoices_tenant_type_number_idx")
      .on(t.tenantId, t.type, t.number)
      .where(sql`${t.number} IS NOT NULL`),
    tenantDateIdx: index("invoices_tenant_date_idx").on(t.tenantId, t.date),
    tenantStatusIdx: index("invoices_tenant_status_idx").on(
      t.tenantId,
      t.status,
    ),
    tenantDueIdx: index("invoices_tenant_due_idx").on(t.tenantId, t.dueDate),
    customerIdx: index("invoices_customer_idx").on(t.customerId),
    voucherIdx: index("invoices_voucher_idx").on(t.voucherId),
  }),
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 4, mode: "number" })
      .notNull()
      .default(1),
    unitPrice: bigint("unit_price", { mode: "number" }).notNull().default(0),
    vatRate: integer("vat_rate").notNull().default(0),
    vatAmount: bigint("vat_amount", { mode: "number" }).notNull().default(0),
    sdRate: integer("sd_rate").notNull().default(0),
    sdAmount: bigint("sd_amount", { mode: "number" }).notNull().default(0),
    total: bigint("total", { mode: "number" }).notNull().default(0),
  },
  (t) => ({
    invoiceIdx: index("il_invoice_idx").on(t.invoiceId),
    productIdx: index("il_product_idx").on(t.productId),
    quantityCheck: check("il_quantity_check", sql`${t.quantity} > 0`),
    vatRateCheck: check(
      "il_vat_rate_check",
      sql`${t.vatRate} >= 0 AND ${t.vatRate} <= 10000`,
    ),
    sdRateCheck: check(
      "il_sd_rate_check",
      sql`${t.sdRate} >= 0 AND ${t.sdRate} <= 10000`,
    ),
  }),
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accountNumber: text("account_number"),
    bankName: text("bank_name"),
    currency: varchar("currency", { length: 8 }).notNull().default("BDT"),
    openingBalance: bigint("opening_balance", { mode: "number" })
      .notNull()
      .default(0),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    tenantIdx: index("bank_accounts_tenant_idx").on(t.tenantId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    partyId: uuid("party_id").references(() => parties.id, {
      onDelete: "set null",
    }),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** 'out' = money paid (payment), 'in' = money received (receipt). */
    direction: varchar("direction", { length: 8 }).notNull().default("out"),
    method: varchar("method", { length: 32 }).notNull().default("cash"),
    reference: text("reference"),
    notes: text("notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    ...timeStamps(),
  },
  (t) => ({
    amountCheck: check("payments_amount_check", sql`${t.amount} > 0`),
    directionCheck: check(
      "payments_direction_check",
      sql`${t.direction} IN ('in','out')`,
    ),
    methodCheck: check(
      "payments_method_check",
      sql`${t.method} IN ('cash','bank','mobile','cheque','card','transfer','other')`,
    ),
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
    partyIdx: index("payments_party_idx").on(t.partyId),
    bankIdx: index("payments_bank_idx").on(t.bankAccountId),
    tenantPaidIdx: index("payments_tenant_paid_idx").on(t.tenantId, t.paidAt),
  }),
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    date: date("date", { mode: "date" }).notNull(),
    description: text("description"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    type: varchar("type", { length: 8 }).notNull(),
    matchedVoucherId: uuid("matched_voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    reconciled: boolean("reconciled").notNull().default(false),
    ...timeStamps(),
  },
  (t) => ({
    typeCheck: check("bt_type_check", sql`${t.type} IN ('debit','credit')`),
    amountCheck: check("bt_amount_check", sql`${t.amount} > 0`),
    tenantDateIdx: index("bt_tenant_date_idx").on(t.tenantId, t.date),
    accountIdx: index("bt_account_idx").on(t.bankAccountId, t.date),
    matchedIdx: index("bt_matched_idx").on(t.matchedVoucherId),
  }),
);

export const taxRates = pgTable(
  "tax_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rate: integer("rate").notNull(), // basis points (1500 = 15.00%)
    kind: varchar("kind", { length: 16 }).notNull().default("vat"),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    tenantIdx: index("tax_rates_tenant_idx").on(t.tenantId),
    nameUniq: uniqueIndex("tax_rates_tenant_name_idx").on(t.tenantId, t.name),
    rateCheck: check(
      "tax_rates_rate_check",
      sql`${t.rate} >= 0 AND ${t.rate} <= 10000`,
    ),
    kindCheck: check(
      "tax_rates_kind_check",
      sql`${t.kind} IN ('vat','ait','vds','customs')`,
    ),
  }),
);

export const companySettings = pgTable(
  "company_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" })
      .unique(),
    companyName: text("company_name").notNull(),
    binNumber: text("bin_number"),
    tinNumber: text("tin_number"),
    fiscalYearStartMonth: integer("fiscal_year_start_month")
      .notNull()
      .default(7),
    currency: varchar("currency", { length: 8 }).notNull().default("BDT"),
    logoUrl: text("logo_url"),
    ...timeStamps(),
  },
  (t) => ({
    fiscalMonthCheck: check(
      "cs_fiscal_month_check",
      sql`${t.fiscalYearStartMonth} >= 1 AND ${t.fiscalYearStartMonth} <= 12`,
    ),
  }),
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 32 }),
    active: boolean("active").notNull().default(true),
    ...timeStamps(),
  },
  (t) => ({
    tenantIdx: index("warehouses_tenant_idx").on(t.tenantId),
    codeUniq: uniqueIndex("warehouses_tenant_code_idx")
      .on(t.tenantId, t.code)
      .where(sql`${t.code} IS NOT NULL`),
  }),
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    /** Destination of a transfer; null for every other movement type. */
    toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    voucherId: uuid("voucher_id").references(() => vouchers.id, {
      onDelete: "set null",
    }),
    /** Business date of the movement (invoice date, or the day of an adjustment). */
    date: date("date", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_DATE`),
    /**
     * Signed quantity. `in` and `out` are stored positive (the type gives the
     * direction); `adjustment` carries its own sign; a transfer stores the moved
     * quantity positive.
     */
    quantity: numeric("quantity", {
      precision: 18,
      scale: 4,
      mode: "number",
    }).notNull(),
    unitCost: bigint("unit_cost", { mode: "number" }).notNull().default(0),
    type: varchar("type", { length: 16 }).notNull(),
    /** Free-text provenance, e.g. the invoice/sequence number. */
    reference: text("reference"),
    ...timeStamps(),
  },
  (t) => ({
    typeCheck: check(
      "sm_type_check",
      sql`${t.type} IN ('in','out','transfer','adjustment')`,
    ),
    quantityCheck: check(
      "sm_quantity_check",
      sql`(${t.type} IN ('in','out','transfer') AND ${t.quantity} > 0) OR (${t.type} = 'adjustment' AND ${t.quantity} <> 0)`,
    ),
    transferCheck: check(
      "sm_transfer_check",
      sql`${t.type} <> 'transfer' OR (${t.toWarehouseId} IS NOT NULL AND ${t.toWarehouseId} <> ${t.warehouseId})`,
    ),
    tenantProductIdx: index("sm_tenant_product_idx").on(
      t.tenantId,
      t.productId,
    ),
    tenantProductDateIdx: index("sm_tenant_product_date_idx").on(
      t.tenantId,
      t.productId,
      t.date,
    ),
    typeCreatedIdx: index("sm_tenant_type_created_idx").on(
      t.tenantId,
      t.type,
      t.createdAt,
    ),
    warehouseIdx: index("sm_warehouse_idx").on(t.warehouseId),
    toWarehouseIdx: index("sm_to_warehouse_idx").on(t.toWarehouseId),
    voucherIdx: index("sm_voucher_idx").on(t.voucherId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    actorRole: varchar("actor_role", { length: 32 }),
    userAgent: text("user_agent"),
    route: text("route"),
    ...timeStamps(),
  },
  (t) => ({
    tenantIdx: index("audit_tenant_idx").on(t.tenantId, t.createdAt),
    resourceIdx: index("audit_tenant_resource_idx").on(
      t.tenantId,
      t.resourceType,
      t.resourceId,
    ),
  }),
);
