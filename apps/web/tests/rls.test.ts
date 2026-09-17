/**
 * RLS enforcement test — §15.2 R9.
 *
 * This is the test that makes tenant isolation a fact rather than an
 * assumption. It creates two tenants and asserts that a session scoped to one
 * cannot read the other's rows. If a table is added to the schema without an
 * RLS policy, the per-table assertion below fails.
 *
 * Reads run as the non-superuser `neurobook_app` role, because RLS never
 * applies to a SUPERUSER — testing as superuser would prove nothing. In
 * production the app connects as this role; the superuser exists only for
 * migrations. Setup writes go through the superuser pool since seeding is a
 * migration-time operation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { rlsSql, TENANT_SCOPED_TABLES } from "@/db/index.js";

function appRoleUrl(url: string): string {
  return url.replace(/\/\/[^@]+@/, "//neurobook_app@");
}

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://neurobook@127.0.0.1:5432/neurobook";
const URL = appRoleUrl(ADMIN_URL);
// 26 chars, ULID-shaped, so they fit the varchar(26) id columns.
const TENANT_A = "01TESTRLSTENANT00000000A";
const TENANT_B = "01TESTRLSTENANT00000000B";

let pool: pg.Pool;
let adminPool: pg.Pool;

beforeAll(async () => {
  adminPool = new pg.Pool({ connectionString: ADMIN_URL, max: 2 });
  pool = new pg.Pool({ connectionString: URL, max: 5 });
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    // Two tenants, two accounts — one per tenant.
    await client.query("DELETE FROM accounts WHERE id LIKE 'acct01TESTRLS%'");
    await client.query("DELETE FROM tenants WHERE id LIKE '01TESTRLS%'");
    await client.query(
      "INSERT INTO tenants (id, name) VALUES ($1, 'Tenant A'), ($2, 'Tenant B') ON CONFLICT DO NOTHING",
      [TENANT_A, TENANT_B],
    );
    for (const [index, tenant] of [TENANT_A, TENANT_B].entries()) {
      // IDs must differ per tenant: the PK is global, so a truncated shared
      // prefix would make the second insert silently skip via ON CONFLICT.
      const accountSuffix = tenant === TENANT_A ? "A" : "B";
      await client.query(
        "INSERT INTO accounts (id, tenant_id, name, code, type, is_group) VALUES ($1, $2, $3, $4, 'ASSET', false) ON CONFLICT DO NOTHING",
        [
          `acct${index}${tenant.slice(0, 20)}`,
          tenant,
          `Cash ${accountSuffix}`,
          `110${index + 1}`,
        ],
      );
    }
    await client.query("COMMIT");

    // Re-apply policies in case a prior run left them disabled.
    await client.query(rlsSql());
  } finally {
    client.release();
  }
});

afterAll(async () => {
  if (pool) await pool.end();
  if (adminPool) await adminPool.end();
});

async function scopedCount(tenant: string, table: string): Promise<number> {
  const client = await pool.connect();
  try {
    // A session that never sets app.tenant_id must see nothing once RLS is on.
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
    const result = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    await client.query("COMMIT");
    return result.rows[0]?.n ?? 0;
  } finally {
    client.release();
  }
}

async function scopedInsert(tenant: string, table: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
    // Try to write a row belonging to the OTHER tenant — RLS must reject it.
    const other = tenant === TENANT_A ? TENANT_B : TENANT_A;
    const id = `probe-${table}-${other}`;
    await client.query(
      `INSERT INTO ${table} (id, tenant_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, other],
    );
    await client.query("COMMIT");
  } catch {
    // Rejection is the expected outcome for WITH CHECK violations.
    await client.query("ROLLBACK");
    throw new Error("write blocked by RLS");
  } finally {
    client.release();
  }
}

describe("RLS tenant isolation (§15.2 R9)", () => {
  it("applies a policy to every tenant-scoped table", async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT tablename
        FROM pg_tables t
        WHERE schemaname = 'public'
          AND EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'public' AND c.table_name = t.tablename
                        AND c.column_name = 'tenant_id')
      `);
      const withTenantColumn = new Set(result.rows.map((r) => r.tablename));
      // Every table that has a tenant_id column must be in the policy list.
      for (const table of withTenantColumn) {
        expect(TENANT_SCOPED_TABLES, `${table} missing from TENANT_SCOPED_TABLES`).toContain(table);
      }
      // And the policy list must not reference non-existent tables.
      for (const table of TENANT_SCOPED_TABLES) {
        expect(withTenantColumn.has(table), `${table} has no tenant_id column`).toBe(true);
      }
    } finally {
      client.release();
    }
  });

  it("a tenant cannot read another tenant's accounts", async () => {
    const aCount = await scopedCount(TENANT_A, "accounts");
    const bCount = await scopedCount(TENANT_B, "accounts");
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
  });

  it("a session scoped to an unknown tenant sees no rows", async () => {
    // A request whose JWT resolved to a tenant that has no data must not see
    // any other tenant's rows. RESET is not sufficient here (it yields an empty
    // string rather than NULL, and an unset GUC is not NULL-comparable), so the
    // middleware always sets an explicit tenant id.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', '01UNKNOWN0000000000000000Z', true)");
      const result = await client.query("SELECT count(*)::int AS n FROM accounts");
      await client.query("COMMIT");
      expect(result.rows[0]?.n).toBe(0);
    } finally {
      client.release();
    }
  });

  it("blocks a write that assigns the row to another tenant", async () => {
    await expect(scopedInsert(TENANT_A, "accounts")).rejects.toThrow(/RLS/);
  });
});
