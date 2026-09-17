/**
 * Row-level security — §15.2 R9.
 *
 * PostgreSQL RLS is the AUTHORITATIVE tenant isolation mechanism. The
 * app-layer `tenant_id` filter is defence-in-depth and is never the sole
 * guard: one forgotten `.where()` would otherwise leak another tenant's books.
 *
 * Each tenant-scoped table gets a policy comparing `tenant_id` against the
 * session-local GUC `app.tenant_id`, which middleware sets per request from
 * the verified JWT. `FORCE ROW LEVEL SECURITY` applies the policy even to the
 * table owner, so a misconfigured superuser connection cannot bypass it.
 */

/** Tables that carry a `tenant_id` column and therefore require an RLS policy. */
export const TENANT_SCOPED_TABLES = [
  "accounts",
  "vouchers",
  "voucher_entries",
  "voucher_sequences",
  "fiscal_periods",
  "idempotency_keys",
  "audit_log",
  "customers",
  "suppliers",
  "user_tenants",
  "sessions",
] as const;

export type TenantScopedTable = (typeof TENANT_SCOPED_TABLES)[number];

/**
 * SQL to enable and force RLS plus the USING/WITH CHECK policies for one table.
 *
 * The `USING` clause governs reads; `WITH CHECK` governs writes, so an insert
 * or update whose `tenant_id` differs from the session's tenant is rejected
 * rather than silently reassigned.
 */
export function rlsPolicySql(table: TenantScopedTable): string {
  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "${table}_tenant_isolation" ON "${table}";`,
    `CREATE POLICY "${table}_tenant_isolation" ON "${table}"`,
    `  USING (tenant_id = current_setting('app.tenant_id', true))`,
    `  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));`,
  ].join("\n");
}

/** Full RLS script for every tenant-scoped table. */
export function rlsSql(): string {
  return TENANT_SCOPED_TABLES.map(rlsPolicySql).join("\n\n");
}

/**
 * Set the session tenant before any query. Called by API middleware once per
 * request from the verified token (R10).
 */
export const SET_TENANT_SQL = "SELECT set_config('app.tenant_id', $1, true);";
