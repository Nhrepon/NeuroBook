import { db } from '../client'
import { parties, products } from '../schema/index'
import { and, eq, sql } from 'drizzle-orm'
import type { RequestScope } from '../scope'
import { PartySchema, type PartyType } from '@neurobook/shared'
import type z from 'zod'

export async function listParties(scope: RequestScope, type?: PartyType) {
  return db
    .select()
    .from(parties)
    .where(
      and(eq(parties.tenantId, scope.tenantId), type ? eq(parties.type, type) : undefined),
    )
    .orderBy(parties.name)
}

export async function getParty(scope: RequestScope, id: string) {
  const [row] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenantId)))
  return row ?? null
}

export async function createParty(
  scope: RequestScope,
  input: z.input<typeof PartySchema>,
) {
  const parsed = PartySchema.parse(input)
  const [row] = await db
    .insert(parties)
    .values({ ...parsed, tenantId: scope.tenantId })
    .returning()
  return row!
}

// U7: parties are deactivated, never removed.
export async function deactivateParty(scope: RequestScope, id: string) {
  const [row] = await db
    .update(parties)
    .set({ active: false })
    .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenantId)))
    .returning()
  if (!row) return null
  return row
}

export async function updateParty(scope: RequestScope, id: string, patch: Record<string, unknown>) {
  const [row] = await db
    .update(parties)
    .set(patch as object)
    .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenantId)))
    .returning()
  return row ?? null
}

// products
export async function listProducts(scope: RequestScope) {
  return db.select().from(products).where(eq(products.tenantId, scope.tenantId))
}

export async function createProduct(scope: RequestScope, input: Record<string, unknown>) {
  const [row] = await db.insert(products).values({ ...input, tenantId: scope.tenantId } as never).returning()
  return row!
}

// `sql` kept for future period queries.
void sql
