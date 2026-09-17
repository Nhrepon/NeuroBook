import { headers } from "next/headers";

/**
 * The dashboard shell — sidebar nav and the signed-in tenant's name.
 *
 * `x-tenant-id` is set by middleware from the verified token (§15.2 R10) and is
 * the only place the tenant id is read on the server side, so no page can
 * resolve it another way.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const tenantId = headerList.get("x-tenant-id");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav style={{ width: "14rem", borderRight: "1px solid CanvasText", padding: "1rem" }}>
        <strong>NeuroBook</strong>
        {tenantId ? (
          <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
            Tenant {tenantId.slice(0, 8)}
          </p>
        ) : null}
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.4rem" }}>
          <li>
            <a href="/dashboard">Dashboard</a>
          </li>
          <li>
            <a href="/dashboard/vouchers">Vouchers</a>
          </li>
          <li>
            <a href="/dashboard/accounts">Accounts</a>
          </li>
          <li>
            <a href="/dashboard/reports">Reports</a>
          </li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: "1.5rem" }}>{children}</main>
    </div>
  );
}
