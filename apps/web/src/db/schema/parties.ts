/**
 * Customers and suppliers (§5.x parties).
 *
 * Parties are deactivated, never deleted (U7), so historical reports stay
 * interpretable. Bangladesh address fields and e-BIN/e-TIN per Phase 1.
 */
import {
  bigint,
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { tenants } from "./tenant.js";

export const customers = pgTable(
  "customers",
  {
    id: varchar("id", { length: 26 }).notNull(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    name: text("name").notNull(),
    /** Bangladesh TIN / BIN for compliance reporting. */
    tin: text("tin"),
    bin: text("bin"),
    email: text("email"),
    phone: text("phone"),
    /** BD address: division / district / upazila / union. */
    addressLine: text("address_line"),
    division: text("division"),
    district: text("district"),
    upazila: text("upazila"),
    union: text("\"union\""),
    /** Opening receivable in minor units, signed. */
    openingBalance: bigint("opening_balance", { mode: "number" }).default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.tenantId] }),
    uniqueIndex("customers_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: varchar("id", { length: 26 }).notNull(),
    tenantId: varchar("tenant_id", { length: 26 }).notNull(),
    name: text("name").notNull(),
    tin: text("tin"),
    bin: text("bin"),
    email: text("email"),
    phone: text("phone"),
    addressLine: text("address_line"),
    division: text("division"),
    district: text("district"),
    upazila: text("upazila"),
    union: text("\"union\""),
    /** Opening payable in minor units, signed. */
    openingBalance: bigint("opening_balance", { mode: "number" }).default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    version: integer("version").default(1).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.tenantId] }),
    uniqueIndex("suppliers_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export const customersRelations = relations(customers, ({ one }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
}));

export const suppliersRelations = relations(suppliers, ({ one }) => ({
  tenant: one(tenants, { fields: [suppliers.tenantId], references: [tenants.id] }),
}));
