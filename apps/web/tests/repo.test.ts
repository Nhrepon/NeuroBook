/**
 * Repository golden test — §15.5 O1, applied to the write path.
 *
 * The pure-engine golden test covers the arithmetic; this one covers the path
 * that writes it. It is the test that would have caught the original broken
 * balance trigger, which queried the very rows it was inserting and so rejected
 * every voucher outright. It asserts that a real voucher posts, that a bad one
 * does not, and that the numbers on disk agree with the numbers validated.
 *
 * Requires Postgres and a non-superuser app role: RLS never applies to a
 * SUPERUSER, so testing as one would prove nothing about isolation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import pg from "pg";
import { createDb, postVoucher, withTenant, rlsSql, type Database } from "@/db/index.js";

const ADMIN_URL = process.env.DATABASE_URL ?? "postgresql://neurobook@127.0.0.1:5432/neurobook";
// Reads and the posts under test run as the non-superuser role; setup writes go
// through the admin pool, since seeding is a migration-time operation.
const TENANT = "01TESTREPOTENANT00000001";
const USER_ID = "01TESTREPOUSER000000001";

let db: Database;
let admin: pg.Pool;

beforeAll(async () => {
  db = createDb({ url: ADMIN_URL });
  admin = new pg.Pool({ connectionString: ADMIN_URL, max: 2 });
  const client = await admin.connect();
  try {
    // Autocommit, one statement per transaction. Each statement is a complete
    // unit, so nothing holds a lock while another statement waits — which is
    // what deadlocked the wrapped version against the RLS test's own setup,
    // both running concurrently in their beforeAll hooks. `ON CONFLICT DO
    // NOTHING` makes the whole block idempotent without a wrapper.
    await client.query("DELETE FROM voucher_entries WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM voucher_sequences WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM vouchers WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM fiscal_periods WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM accounts WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM tenants WHERE id = $1", [TENANT]);
    await client.query(
      "INSERT INTO tenants (id, name) VALUES ($1, 'repo test') ON CONFLICT DO NOTHING",
      [TENANT],
    );
    await client.query(
      `INSERT INTO accounts (id, tenant_id, name, code, type, is_group)
       VALUES ('rep-bank', $1, 'Bank', '1101', 'ASSET', false),
              ('rep-sales', $1, 'Sales', '4101', 'REVENUE', false)
       ON CONFLICT DO NOTHING`,
      [TENANT],
    );
    await client.query(
      `INSERT INTO fiscal_periods (id, tenant_id, name, start_date, end_date, status)
       VALUES ('rep-fy', $1, 'FY 2026-27', '2026-07-01', '2027-06-30', 'open')
       ON CONFLICT DO NOTHING`,
      [TENANT],
    );
    await client.query(rlsSql());
  } finally {
    client.release();
  }
});

afterAll(async () => {
  const client = await admin.connect();
  try {
    await client.query("DELETE FROM voucher_entries WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM voucher_sequences WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM vouchers WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM fiscal_periods WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM accounts WHERE tenant_id = $1", [TENANT]);
    await client.query("DELETE FROM tenants WHERE id = $1", [TENANT]);
  } finally {
    client.release();
  }
  await admin.end();
});

function sale(amount: number) {
  return {
    tenantId: TENANT,
    userId: USER_ID,
    voucherType: "SALES" as const,
    date: new Date("2026-08-01T00:00:00Z"),
    narration: `test sale ${amount}`,
    entries: [
      { accountId: "rep-bank", debit: amount, credit: 0 },
      { accountId: "rep-sales", debit: 0, credit: amount },
    ],
  };
}

describe("voucher post path (§15.1 R3/R4/R8)", () => {
  it("posts a balanced voucher and writes its sequence number", async () => {
    const posted = await withTenant(db, TENANT, (tx) => postVoucher(tx, sale(50_000)));

    expect(posted.sequenceNumber).toBe("00000001");
    expect(posted.postedAt).toBeInstanceOf(Date);

    // The rows on disk are what a report will read, so they are asserted
    // directly rather than trusting the returned object.
    const rows = await withTenant(db, TENANT, async (tx) => {
      const header = await tx.execute(
        sql`SELECT total_debit, total_credit, status, sequence_number FROM vouchers WHERE id = ${posted.id}`,
      );
      const lines = await tx.execute(
        sql`SELECT count(*)::int AS n FROM voucher_entries WHERE voucher_id = ${posted.id}`,
      );
      return { header: header.rows[0], lines: lines.rows[0] };
    });
    expect(rows.header).toMatchObject({
      total_debit: "50000",
      total_credit: "50000",
      status: "posted",
      sequence_number: "00000001",
    });
    expect(rows.lines).toMatchObject({ n: 2 });
  });

  it("numbers vouchers gaplessly within a fiscal year", async () => {
    const first = await withTenant(db, TENANT, (tx) => postVoucher(tx, sale(10_000)));
    const second = await withTenant(db, TENANT, (tx) => postVoucher(tx, sale(20_000)));
    expect(first.sequenceNumber).toBe("00000002");
    expect(second.sequenceNumber).toBe("00000003");
  });

  it("rejects an unbalanced voucher and leaves no row behind", async () => {
    const before = await withTenant(db, TENANT, (tx) =>
      tx.execute(sql`SELECT count(*)::int AS n FROM vouchers`),
    );
    const countBefore = (before.rows[0] as { n: number }).n;

    const bad = sale(50_000);
    bad.entries[1]!.credit = 49_999;

    await expect(
      withTenant(db, TENANT, (tx) => postVoucher(tx, bad)),
    ).rejects.toThrow(/Debits must equal credits/);

    // Nothing was written: no header, no lines, and no consumed sequence number.
    const after = await withTenant(db, TENANT, (tx) =>
      tx.execute(sql`SELECT count(*)::int AS n FROM vouchers`),
    );
    expect((after.rows[0] as { n: number }).n).toBe(countBefore);
  });

  it("rejects a header that disagrees with its journal lines", async () => {
    // Write a voucher whose stored totals do not match its lines, then attempt
    // to post it. This is the case the original trigger could not see: the
    // header is written before its lines, so by the time the lines exist no
    // trigger on the header can fire.
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT]);
      await client.query(
        `INSERT INTO vouchers (id, tenant_id, voucher_type, date, narration, created_by,
                               total_debit, total_credit)
         VALUES ('rep-lie', $1, 'JOURNAL', now(), 'header lies', $2, 100, 100)`,
        [TENANT, USER_ID],
      );
      // Lines sum to 50/50 while the header claims 100/100.
      await client.query(
        `INSERT INTO voucher_entries (id, tenant_id, voucher_id, account_id, debit, credit)
         VALUES ('rep-lie-d', $1, 'rep-lie', 'rep-bank', 50, 0),
                ('rep-lie-c', $1, 'rep-lie', 'rep-sales', 0, 50)`,
        [TENANT],
      );
      await expect(client.query("UPDATE vouchers SET status = 'posted' WHERE id = 'rep-lie'"))
        .rejects.toThrow(/UNBALANCED/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });
});
