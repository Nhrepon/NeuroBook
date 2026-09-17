/**
 * Drizzle client (§3.4 `packages/db`).
 *
 * Postgres via `drizzle-orm/node-postgres`. The SQLite adapter for offline
 * desktop/mobile is Phase 2 and swaps here; the schema is shared.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export { schema };

/** Drizzle client bound to the Postgres adapter and this schema. */
export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface CreateDbOptions {
  url?: string;
  /** Max pool connections. Defaults to 10. */
  max?: number;
}

/**
 * Create a Drizzle client. The URL is validated by packages/config at boot
 * (O5), so this receives a known-good value.
 */
export function createDb(options: CreateDbOptions = {}): Database {
  const url = options.url ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. packages/config must validate it at boot (§15.5 O5).",
    );
  }

  const pool = new Pool({
    connectionString: url,
    max: options.max ?? 10,
    // Statements here are small; prepared statements over a pooled connection
    // are fine and keep parameterised queries (SQL-injection prevention, §7.2).
    statement_timeout: 30_000,
  });

  return drizzle(pool, { schema });
}

/**
 * Transaction type passed to `withTenant`'s callback.
 */
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Run `fn` inside a transaction with the session tenant set (R10).
 *
 * Setting the GUC inside the transaction is what makes the RLS policies see
 * the correct tenant for every statement in `fn`, including the post path's
 * sequence increment, balance validation and journal write (R8).
 */
export async function withTenant<T>(
  db: Database,
  tenantId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
