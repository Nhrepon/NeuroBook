import { eq } from 'drizzle-orm'
import { db } from '../client'
import { companySettings, tenants } from '../schema'

/**
 * One-off repair for the era when Settings only wrote `company_settings.company_name`
 * and everything else read `tenants.name`. Copies the (edited) settings name back
 * onto the canonical `tenants.name`, and gives tenants that never had a settings
 * row one so their Settings form is not blank.
 *
 *   npm run db:sync-names              # report and repair
 *   npm run db:sync-names -- --report  # report only, change nothing
 */
async function main() {
  const dry = process.argv.includes('--report')

  const rows = await db
    .select({
      tenantId: tenants.id,
      slug: tenants.slug,
      tenantName: tenants.name,
      settingsId: companySettings.id,
      companyName: companySettings.companyName,
    })
    .from(tenants)
    .leftJoin(companySettings, eq(companySettings.tenantId, tenants.id))
    .orderBy(tenants.slug)

  let created = 0
  let renamed = 0

  for (const row of rows) {
    if (!row.settingsId) {
      console.log(`+ ${row.slug.padEnd(20)} created company_settings "${row.tenantName}"`)
      created++
      if (!dry) {
        await db.insert(companySettings).values({ tenantId: row.tenantId, companyName: row.tenantName })
      }
      continue
    }

    if (row.companyName && row.companyName !== row.tenantName) {
      console.log(`~ ${row.slug.padEnd(20)} "${row.tenantName}" -> "${row.companyName}"`)
      renamed++
      if (!dry) {
        await db
          .update(tenants)
          .set({ name: row.companyName, updatedAt: new Date() })
          .where(eq(tenants.id, row.tenantId))
      }
    }
  }

  if (created === 0 && renamed === 0) {
    console.log('Every company name already agrees. Nothing to do.')
  } else {
    console.log(`\n${renamed} company name(s) repaired, ${created} settings row(s) created${dry ? ' (dry run)' : ''}.`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
