import { db } from '../client'
import { tenants } from '../schema'
import { ensureDefaultChart } from '../chart'
import { ensureDefaultTaxRates } from '../tax-seed'

/**
 * Backfills the default chart of accounts and tax rates for every existing
 * tenant. Companies keep their own edits: only missing rows are inserted.
 */
async function main() {
  const all = await db.select({ id: tenants.id, slug: tenants.slug, name: tenants.name }).from(tenants)
  let total = 0
  let totalTax = 0

  for (const tenant of all) {
    const added = await ensureDefaultChart(tenant.id)
    const addedTax = await ensureDefaultTaxRates(tenant.id)
    total += added
    totalTax += addedTax
    console.log(
      `${tenant.slug.padEnd(24)} +${String(added).padStart(2)} ledgers  +${String(addedTax).padStart(2)} tax rates`,
    )
  }

  console.log(`\n${all.length} tenants checked, ${total} ledger accounts and ${totalTax} tax rates added.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })