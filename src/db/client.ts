// Single Drizzle client, with the connection options that match the
// production Postgres setup. The repository is the only place that calls
// this — R10 says ad-hoc db.select() must be blocked.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

declare global {
  // eslint-disable-next-line no-var
  var __pg__: ReturnType<typeof postgres> | undefined
}

const connection =
  globalThis.__pg__ ??
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    prepare: false, // RLS-friendly: never use server-side prepared statements
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__pg__ = connection
}

export const db = drizzle(connection, { schema, logger: process.env.LOG_LEVEL === 'debug' })
export type DB = typeof db
