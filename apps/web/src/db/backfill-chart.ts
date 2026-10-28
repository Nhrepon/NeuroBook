import { db } from './client'
import { tenants } from './schema'
import { ensureDefaultChart } from './chart'

/**
 * Backfills the default chart of accounts for every existing tenant.
 * Companies keep their own edits: only missing codes are inserted.
 */
async function main() {
  const all = await db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name }).from(tenants)
  let total = 0

  for (const tenant of all) {
    const added = await ensureDefaultChart(tenant.id)
    total += added
    console.log(`${tenant.slug.padEnd(24)} +${String(added).padStart(2)} ledgers`)
  }

  console.log(`\n${all.length} tenants checked, ${total} ledger accounts added.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })