import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { categories } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

const Schema = z.object({ name: z.string().trim().min(1).max(64) })
const UpdateSchema = Schema.extend({ id: z.string().uuid() })

export async function getAllCategories() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(categories).where(eq(categories.tenantId, scope.tenantId)).orderBy(categories.name),
  )
}

export async function createCategory(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('a category name is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, scope.tenantId), eq(categories.name, parsed.data.name)))
    if (existing) return existing

    const [row] = await tx.insert(categories).values({ tenantId: scope.tenantId, name: parsed.data.name }).returning()
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'category.create', resourceType: 'category', resourceId: row.id, after: { name: row.name } },
      tx,
    )
    return row
  })
}

export async function updateCategory(input: unknown) {
  const scope = await requireScope()
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('id and a new name are required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.id), eq(categories.tenantId, scope.tenantId)))
    if (!target) throw notFound('category not found')

    const [clash] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, scope.tenantId), eq(categories.name, parsed.data.name)))
    if (clash && clash.id !== target.id) throw conflict('a category with that name already exists')

    const [row] = await tx
      .update(categories)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(and(eq(categories.id, parsed.data.id), eq(categories.tenantId, scope.tenantId)))
      .returning()
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'category.update', resourceType: 'category', resourceId: parsed.data.id, before: { name: target.name }, after: { name: row.name } },
      tx,
    )
    return row
  })
}

export async function deleteCategory(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, scope.tenantId)))
    if (!target) throw notFound('category not found')

    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, scope.tenantId)))
    await writeAudit(
      { tenantId: scope.tenantId, userId: scope.userId, action: 'category.delete', resourceType: 'category', resourceId: id, before: { name: target.name } },
      tx,
    )
    return { id, name: target.name }
  })
}