import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { parties } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, notFound } from '@/controllers/errors'

const CreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  active: z.boolean().optional(),
})

export async function getAllParties(type?: string | null) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(parties).where(eq(parties.tenantId, scope.tenantId))
    return type ? rows.filter((r) => r.type === type) : rows
  })
}

export async function createParty(input: unknown) {
  const scope = await requireScope()
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx.insert(parties).values({ tenantId: scope.tenantId, ...parsed.data }).returning()
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'party.create', resourceType: 'party', resourceId: row.id, after: { name: row.name, type: row.type } },
      tx,
    )
    return row
  })
}

export async function updateParty(input: unknown) {
  const scope = await requireScope()
  const parsed = PatchSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')
  const d = parsed.data

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(parties)
      .where(and(eq(parties.id, d.id), eq(parties.tenantId, scope.tenantId)))
    if (!target) throw notFound('party not found')

    const patch: Record<string, unknown> = {}
    if (d.name !== undefined) patch.name = d.name
    if (d.type !== undefined) patch.type = d.type
    if (d.email !== undefined) patch.email = d.email
    if (d.phone !== undefined) patch.phone = d.phone
    if (d.address !== undefined) patch.address = d.address
    if (d.active !== undefined) patch.active = d.active
    if (Object.keys(patch).length === 0) throw badRequest('nothing to update')

    const [row] = await tx
      .update(parties)
      .set(patch)
      .where(and(eq(parties.id, d.id), eq(parties.tenantId, scope.tenantId)))
      .returning()
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'party.update', resourceType: 'party', resourceId: row.id, before: { name: target.name, type: target.type }, after: { name: row.name, type: row.type } },
      tx,
    )
    return row
  })
}

export async function deleteParty(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(parties)
      .where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenantId)))
    if (!target) throw notFound('party not found')

    await tx.delete(parties).where(and(eq(parties.id, id), eq(parties.tenantId, scope.tenantId)))
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'party.delete', resourceType: 'party', resourceId: id, before: { name: target.name, type: target.type } },
      tx,
    )
    return { id, name: target.name }
  })
}