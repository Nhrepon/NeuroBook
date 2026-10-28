import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db } from '@/db/client'
import { tenants } from '@/db/schema'
import { baseSlug } from './company-slug'

export { baseSlug }

/** Reserves a slug nobody else holds, appending random bytes when taken. */
export async function uniqueSlug(desired: string) {
  const seed = baseSlug(desired) || 'company'
  let candidate = seed
  for (let i = 0; i < 5; i++) {
    const [taken] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, candidate))
    if (!taken) return candidate
    candidate = `${seed.slice(0, 43)}-${randomBytes(3).toString('hex')}`
  }
  return `company-${randomBytes(6).toString('hex')}`
}
