// Test setup. Provides a non-superuser Postgres role for the repository
// tests so RLS is exercised end-to-end.
import { beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

let sql: ReturnType<typeof postgres> | undefined

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return   // unit-only suites skip DB
  sql = postgres(process.env.DATABASE_URL, { max: 2 })
  await sql`SET ROLE neurobook_app`
})

afterAll(async () => {
  await sql?.end()
})
