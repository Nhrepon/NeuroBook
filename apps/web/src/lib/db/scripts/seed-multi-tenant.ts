import argon2 from 'argon2'
import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { companySettings, tenants, users } from '../schema'
import { ensureDefaultChart } from '../chart'

/**
 * Adds one shared login to a second company so multi-tenant behaviour (company
 * code prompt on login, the dashboard company switcher, cross-company isolation)
 * can be exercised locally.
 *
 *   npm run db:multi-tenant           # create/refresh the second company
 *   npm run db:multi-tenant -- --remove   # delete it again
 *
 * Everything goes through the owner connection: this runs before any tenant
 * context exists, exactly like `db:seed`.
 */
const SLUG = 'demo-two'
const NAME = 'Demo Company Two'
const EMAIL = 'admin@demo.com'
const PASSWORD = 'password123'
const ROLE = 'ADMIN'

async function remove() {
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, SLUG))
  if (!tenant) {
    console.log(`No '${SLUG}' company to remove.`)
    return
  }
  await db.delete(tenants).where(eq(tenants.id, tenant.id))
  console.log(`Removed '${SLUG}' and every row scoped to it.`)
  console.log(`${EMAIL} is back to a single company.`)
}

async function seed() {
  let [tenant] = await db.select().from(tenants).where(eq(tenants.slug, SLUG))
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id })

  if (!tenant) {
    ;[tenant] = await db.insert(tenants).values({ name: NAME, slug: SLUG, passwordHash: hash }).returning()
    console.log(`Created company '${NAME}' (code: ${SLUG}).`)
  } else if (!tenant.passwordHash) {
    await db.update(tenants).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(tenants.id, tenant.id))
    console.log(`Set the company password for '${SLUG}'.`)
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, EMAIL)))

  if (!existing) {
    await db.insert(users).values({ tenantId: tenant.id, email: EMAIL, passwordHash: hash, role: ROLE })
    console.log(`Added ${EMAIL} as ${ROLE}.`)
  } else {
    console.log(`${EMAIL} already has access to ${SLUG}.`)
  }

  const [settings] = await db
    .select({ id: companySettings.id })
    .from(companySettings)
    .where(eq(companySettings.tenantId, tenant.id))
  if (!settings) {
    await db.insert(companySettings).values({ tenantId: tenant.id, companyName: NAME })
  }

  const added = await ensureDefaultChart(tenant.id)
  console.log(added > 0 ? `Added ${added} default ledger accounts.` : 'Chart of accounts already complete.')

  console.log(`\n${EMAIL} now belongs to 2 companies, so the company code is required at sign-in:`)
  console.log(`  demo       (Demo Company, ADMIN)`)
  console.log(`  ${SLUG}  (${NAME}, ${ROLE})`)
  console.log(`\nLogin password:   ${PASSWORD} (per person)`)
  console.log(`Company password: ${PASSWORD} (per company, asked for on switch)`)
  console.log(`\nSign in with either code, then use "Switch company" on the dashboard.`)
  console.log(`Undo with: npm run db:multi-tenant -- --remove`)
}

const removeRequested = process.argv.includes('--remove')
const run = removeRequested ? remove : seed

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
