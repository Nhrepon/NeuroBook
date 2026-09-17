/** Voucher list — Server Component. Tenant scope from middleware headers (§15.2 R10). */
import Link from "next/link";
import { headers } from "next/headers";
import { asc, desc, eq, sql } from "drizzle-orm";
import { createDb } from "@/db/index.js";
import { vouchers } from "@/db/schema/index.js";
import { formatTaka } from "@neurobook/shared";

const PAGE = 50;

export default async function VoucherListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return <p>unauthorized</p>;

  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PAGE;
  const db = createDb({ max: 5 });

  // Two queries, no ORM abstraction needed.
  const list = await db
    .select({
      id: vouchers.id,
      seq: vouchers.sequenceNumber,
      type: vouchers.voucherType,
      date: vouchers.date,
      narration: vouchers.narration,
      status: vouchers.status,
      debit: vouchers.totalDebit,
      credit: vouchers.totalCredit,
    })
    .from(vouchers)
    .where(eq(vouchers.tenantId, tenantId))
    .orderBy(desc(vouchers.date), desc(vouchers.sequenceNumber))
    .limit(PAGE)
    .offset(offset);

  const totalResult = await db.execute(
    sql`SELECT count(*)::int AS n FROM vouchers WHERE tenant_id = ${tenantId}`,
  );
  const total = (totalResult.rows[0] as { n: number }).n;
  const pages = Math.ceil(total / PAGE);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Vouchers</h1>
        <Link href="/dashboard/vouchers/new">
          <button>+ New Voucher</button>
        </Link>
      </div>

      {list.length === 0 ? (
        <p style={{ marginTop: "1rem", opacity: 0.6 }}>No vouchers yet.</p>
      ) : (
        <table style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Seq</th>
              <th>Date</th>
              <th>Type</th>
              <th>Narration</th>
              <th style={{ textAlign: "right" }}>Debit</th>
              <th style={{ textAlign: "right" }}>Credit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link
                    href={`/dashboard/vouchers/${v.id}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {v.seq ?? v.id.slice(0, 8)}
                  </Link>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {v.date ? String(v.date).slice(0, 10) : "—"}
                </td>
                <td>{v.type}</td>
                <td>{v.narration ?? "—"}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatTaka(Number(v.debit))}
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatTaka(Number(v.credit))}
                </td>
                <td
                  style={{
                    color:
                      v.status === "posted"
                        ? "green"
                        : v.status === "reversed"
                          ? "orange"
                          : undefined,
                  }}
                >
                  {v.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "0.75rem",
          fontSize: "0.875rem",
          opacity: 0.6,
        }}
      >
        <span>{total} voucher{total !== 1 ? "s" : ""}</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {page > 1 ? (
            <Link href={`?page=${page - 1}`}>← Prev</Link>
          ) : null}
          <span>
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={`?page=${page + 1}`}>Next →</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
