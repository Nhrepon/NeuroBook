import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const OWNER_URL =
  process.env.DATABASE_URL ?? 'postgres://neurobook:neurobook@localhost:5432/neurobook'
const APP_URL =
  process.env.APP_DATABASE_URL ?? 'postgres://neurobook_app:neurobook_app@localhost:5432/neurobook'

/**
 * Owner connection. Only used for authentication (tenant resolution happens
 * before a tenant context exists) and for migrations/seeding. Never use it for
 * tenant business data.
 */
export const db = drizzle(postgres(OWNER_URL), { schema })

/**
 * Restricted connection used by all tenant-scoped queries. The `neurobook_app`
 * role does not own the tables, so PostgreSQL row-level security is enforced on
 * every statement; `withTenant()` sets `app.tenant_id` inside a transaction.
 */
export const tenantDb = drizzle(postgres(APP_URL), { schema })
