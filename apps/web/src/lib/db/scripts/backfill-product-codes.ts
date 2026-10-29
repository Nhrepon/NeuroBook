import { eq } from 'drizzle-orm'
import { db } from '../client'
import { products } from '../schema'

/**
 * Gives every existing product an automatic code (`P-0001`) if it has none.
 * Custom codes are left untouched, and the sequence skips anything already in
 * use. Safe to run more than once.
 */
const PATTERN = /^P-(\d+)$/i
const format = (n: number) => `P-${String(n).padStart(4, '0')}`

async function main() {
  const rows = await db
    .select({ id: products.id, tenantId: products.tenantId, code: products.code })
    .from(products)

  const byTenant = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byTenant.get(row.tenantId) ?? []
    list.push(row)
    byTenant.set(row.tenantId, list)
  }

  let updated = 0

  for (const [tenantId, list] of byTenant) {
    const taken = new Set(list.filter((p) => p.code).map((p) => p.code!.toLowerCase()))
    let next = 1
    for (const p of list) {
      if (p.code) {
        const match = PATTERN.exec(p.code)
        if (match) next = Math.max(next, Number(match[1]) + 1)
      }
    }

    for (const p of list) {
      if (p.code) continue
      let code = format(next)
      while (taken.has(code.toLowerCase())) {
        next += 1
        code = format(next)
      }
      next += 1
      taken.add(code.toLowerCase())

      await db.update(products).set({ code, updatedAt: new Date() }).where(eq(products.id, p.id))
      updated += 1
    }
    console.log(`${tenantId.slice(0, 8)}  ${list.length} products checked`)
  }

  console.log(`\n${rows.length} products checked, ${updated} automatic codes assigned.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })