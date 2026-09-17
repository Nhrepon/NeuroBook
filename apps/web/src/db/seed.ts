/**
 * Seed: a demo tenant, an admin user, and the Bangladesh chart of accounts.
 *
 * The COA template MUST include the `Rounding Difference` account: §15.1 R7
 * posts any per-line rounding residual there so the voucher always balances
 * exactly. Without it R7 is unenforceable.
 */
import { createDb } from "./client.js";
import { accounts, tenants, userTenants, users, fiscalPeriods } from "./schema/index.js";

// Deterministic IDs for a seed — stable across runs so the seed is idempotent
// and tests can reference these identifiers.
const TENANT_ID = "01HQ5X7T1NVYTESTTENANT01";
const USER_ID = "01HQ5X7T1NVYTESTUSER0001";
const FY_ID = "01HQ5X7T1NVYTESTFY000001";

/** BD COA template: code, name, type, isGroup. */
const COA_TEMPLATE: Array<[string, string, "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE", boolean]> = [
  ["1", "Capital Account", "ASSET", true],
  ["11", "Current Assets", "ASSET", true],
  ["1101", "Cash in Hand", "ASSET", false],
  ["1102", "Bank Accounts", "ASSET", false],
  ["1103", "Sundry Debtors", "ASSET", false],
  ["1104", "Inventory", "ASSET", false],
  ["12", "Fixed Assets", "ASSET", true],
  ["1201", "Office Equipment", "ASSET", false],
  ["1202", "Furniture & Fixtures", "ASSET", false],
  ["1203", "Accumulated Depreciation", "ASSET", false],
  ["2", "Current Liabilities", "LIABILITY", true],
  ["21", "Liabilities", "LIABILITY", true],
  ["2101", "Sundry Creditors", "LIABILITY", false],
  ["2102", "VAT Payable", "LIABILITY", false],
  ["2103", "TDS Payable", "LIABILITY", false],
  ["2104", "Bank Overdraft", "LIABILITY", false],
  ["2105", "Loans & Advances (Liability)", "LIABILITY", false],
  ["3", "Capital & Liabilities", "EQUITY", true],
  ["31", "Capital Account", "EQUITY", true],
  ["3101", "Capital Account", "EQUITY", false],
  ["3102", "Retained Earnings", "EQUITY", false],
  // R7 depends on this. Rounding residuals land here so a voucher always foots.
  ["3999", "Rounding Difference", "EQUITY", false],
  ["4", "Revenue", "REVENUE", true],
  ["41", "Sales", "REVENUE", true],
  ["4101", "Sales Account", "REVENUE", false],
  ["4102", "Sales Returns", "REVENUE", false],
  ["42", "Other Income", "REVENUE", true],
  ["4201", "Interest Received", "REVENUE", false],
  ["5", "Expenses", "EXPENSE", true],
  ["51", "Direct Expenses", "EXPENSE", true],
  ["5101", "Purchase Account", "EXPENSE", false],
  ["5102", "Direct Expenses", "EXPENSE", false],
  ["5103", "Stock Adjustment", "EXPENSE", false],
  ["52", "Indirect Expenses", "EXPENSE", true],
  ["5201", "Salary & Wages", "EXPENSE", false],
  ["5202", "Rent Paid", "EXPENSE", false],
  ["5203", "Electricity & Utilities", "EXPENSE", false],
  ["5204", "Printing & Stationery", "EXPENSE", false],
  ["5205", "Bank Charges", "EXPENSE", false],
  ["5206", "Depreciation", "EXPENSE", false],
  ["5207", "VAT on Purchases", "EXPENSE", false],
  ["5208", "TDS on Expenses", "EXPENSE", false],
];

/**
 * Seed the demo data. `passwordHash` is required: the seed does not invent one,
 * because a placeholder hash would be an unverifiable login the demo could
 * never use (§15.2 R11). Generate it with `npm run db:hash`, then set
 * SEED_PASSWORD_HASH before running `npm run db:seed`.
 */
export async function seed(): Promise<void> {
  const passwordHash = process.env.SEED_PASSWORD_HASH;
  if (!passwordHash) {
    throw new Error(
      "SEED_PASSWORD_HASH is not set. Generate one with `npm run db:hash` and export it before seeding.",
    );
  }

  const db = createDb();

  await db
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: "NeuroBook Demo Ltd",
      bin: null,
      tin: null,
      baseCurrency: "BDT",
      fiscalYearStartMonth: 7,
      locale: "en",
    })
    .onConflictDoNothing({ target: tenants.id });

  await db
    .insert(users)
    .values({
      id: USER_ID,
      email: "admin@neurobook.test",
      name: "Demo Admin",
      passwordHash,
      twoFactorRequired: true,
      emailVerified: true,
    })
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(userTenants)
    .values({
      userId: USER_ID,
      tenantId: TENANT_ID,
      role: "SUPER_ADMIN",
      isDefault: true,
    })
    .onConflictDoNothing();

  // Fiscal year 1 Jul 2026 – 30 Jun 2027 (BD convention).
  await db
    .insert(fiscalPeriods)
    .values({
      id: FY_ID,
      tenantId: TENANT_ID,
      name: "FY 2026-27",
      startDate: new Date("2026-07-01T00:00:00+06:00"),
      endDate: new Date("2027-06-30T23:59:59+06:00"),
      status: "open",
    })
    .onConflictDoNothing({ target: fiscalPeriods.id });

  // Chart of accounts. IDs are derived from the code for stability.
  const now = new Date();
  const rows = COA_TEMPLATE.map(([code, name, type, isGroup]) => ({
    id: `01HQ5X7T1NVYCOA${code.padStart(6, "0")}`,
    tenantId: TENANT_ID,
    name,
    code,
    type,
    isGroup,
    openingBalance: 0,
    taxApplicable: false,
    active: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(accounts).values(rows).onConflictDoNothing({ target: accounts.id });

  console.log(`seeded tenant ${TENANT_ID}, user ${USER_ID}, ${rows.length} accounts`);
}

const isMain = process.argv[1]?.endsWith("seed.ts") ?? false;
if (isMain) {
  seed().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
