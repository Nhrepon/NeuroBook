import { sql } from 'drizzle-orm'
import { tenantDb } from './client'

/** Transaction handle bound to a single tenant for the duration of the query. */
export type TenantTx = Parameters<Parameters<typeof tenantDb.transaction>[0]>[0]

/**
 * Runs `fn` inside a transaction whose `app.tenant_id` GUC is set. The GUC is
 * transaction-local, so it can never leak to another request over a pooled
 * connection. Postgres RLS policies read this value.
 */
export async function withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return tenantDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx)
  })
}
