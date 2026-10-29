import postgres from 'postgres'

const OWNER_URL =
  process.env.DATABASE_URL ?? 'postgres://neurobook:neurobook@localhost:5432/neurobook'
const APP_ROLE = process.env.APP_DB_ROLE ?? 'neurobook_app'
const APP_PASSWORD = process.env.APP_DB_PASSWORD ?? 'neurobook_app'

const TENANT_TABLES = [
  'users',
  'sessions',
  'accounts',
  'categories',
  'fiscal_periods',
  'voucher_sequences',
  'vouchers',
  'journal_lines',
  'idempotency_keys',
  'parties',
  'products',
  'product_skus',
  'invoices',
  'invoice_lines',
  'payments',
  'bank_accounts',
  'bank_transactions',
  'tax_rates',
  'company_settings',
  'warehouses',
  'stock_movements',
  'audit_log',
]

const sql = postgres(OWNER_URL, { max: 1 })

function q(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

async function main() {
  const dbName = decodeURIComponent(new URL(OWNER_URL).pathname.replace(/^\//, '')) || 'postgres'

  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${q(APP_ROLE)} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
      ELSE
        ALTER ROLE ${q(APP_ROLE)} WITH LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
    END
    $$;
  `)

  await sql.unsafe(`GRANT CONNECT ON DATABASE ${q(dbName)} TO ${q(APP_ROLE)};`)
  await sql.unsafe(`GRANT USAGE ON SCHEMA public TO ${q(APP_ROLE)};`)
  await sql.unsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${q(APP_ROLE)};`)
  await sql.unsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${q(APP_ROLE)};`)
  await sql.unsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${q(APP_ROLE)};`,
  )
  await sql.unsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${q(APP_ROLE)};`,
  )

  for (const table of TENANT_TABLES) {
    await sql.unsafe(`ALTER TABLE ${q(table)} ENABLE ROW LEVEL SECURITY;`)
    await sql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON ${q(table)};`)
    await sql.unsafe(`
      CREATE POLICY tenant_isolation ON ${q(table)}
        USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
    `)
  }

  // The tenants table is keyed by id instead of tenant_id.
  await sql.unsafe(`ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;`)
  await sql.unsafe(`DROP POLICY IF EXISTS tenant_isolation ON "tenants";`)
  await sql.unsafe(`
    CREATE POLICY tenant_isolation ON "tenants"
      USING (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (id = nullif(current_setting('app.tenant_id', true), '')::uuid);
  `)

  const check = await sql.unsafe<{ relname: string; relrowsecurity: boolean }[]>(
    `SELECT relname, relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY relname`,
  )
  const off = check.filter((r) => !r.relrowsecurity).map((r) => r.relname)
  console.log(`RLS enabled on ${check.length - off.length}/${check.length} tables for role ${APP_ROLE}.`)
  if (off.length) console.log(`Tables without RLS: ${off.join(', ')}`)

  await sql.end()
}

main().catch(async (error) => {
  console.error(error)
  await sql.end({ timeout: 1 })
  process.exit(1)
})
