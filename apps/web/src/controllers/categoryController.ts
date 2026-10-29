import { and, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { categories, products } from '@/lib/db/schema'
import { withTenant, type TenantTx } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { requirePermission, requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'

/** Collapses runs of whitespace so "Office  Supplies" and "Office Supplies" agree. */
function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

const Fields = {
  name: z.string().trim().min(1).max(64),
  code: z.string().trim().min(1).max(32).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
}

const Schema = z.object(Fields)
const UpdateSchema = z.object({ id: z.string().uuid(), ...Fields })

/** Category names are compared case-insensitively, matching the unique index. */
const sameName = (name: string) => sql`lower(${categories.name}) = lower(${name})`

/**
 * Validates the parent: it must belong to the company, cannot be the category
 * itself, and cannot be one of its descendants (which would create a cycle).
 */
async function resolveParent(
  tx: TenantTx,
  tenantId: string,
  parentId: string | null | undefined,
  selfId?: string,
): Promise<string | null> {
  if (!parentId) return null

  const [parent] = await tx
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(and(eq(categories.id, parentId), eq(categories.tenantId, tenantId)))
  if (!parent) throw badRequest('the parent category does not exist in this company')
  if (selfId && parent.id === selfId) throw badRequest('a category cannot be its own parent')

  if (selfId) {
    let cursor = parent.parentId
    for (let guard = 0; cursor && guard < 100; guard += 1) {
      if (cursor === selfId) {
        throw badRequest('a category cannot be moved under one of its own children')
      }
      const [up] = await tx
        .select({ parentId: categories.parentId })
        .from(categories)
        .where(eq(categories.id, cursor))
      cursor = up?.parentId ?? null
    }
  }

  return parent.id
}

async function assertCodeFree(tx: TenantTx, tenantId: string, code: string | null, selfId?: string) {
  if (!code) return
  const conds = [eq(categories.tenantId, tenantId), sql`lower(${categories.code}) = lower(${code})`]
  if (selfId) conds.push(ne(categories.id, selfId))
  const [clash] = await tx.select({ id: categories.id }).from(categories).where(and(...conds))
  if (clash) throw conflict('a category with that code already exists')
}

export async function getAllCategories() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx
      .select({
        id: categories.id,
        name: categories.name,
        code: categories.code,
        description: categories.description,
        parentId: categories.parentId,
        active: categories.active,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
        /** How many products use this category directly. */
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(categories)
      .leftJoin(
        products,
        and(eq(products.categoryId, categories.id), eq(products.tenantId, scope.tenantId)),
      )
      .where(eq(categories.tenantId, scope.tenantId))
      .groupBy(categories.id)
      .orderBy(categories.name),
  )
}

export async function createCategory(input: unknown) {
  const scope = await requirePermission('product:write')
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('a category name of 1–64 characters is required')
  const name = normaliseName(parsed.data.name)
  const code = parsed.data.code ? parsed.data.code.trim() : null

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, scope.tenantId), sameName(name)))
    // Creating the same category twice is a no-op; callers rely on that when a
    // product is saved with a free-text category that already exists.
    if (existing) return existing

    const parentId = await resolveParent(tx, scope.tenantId, parsed.data.parentId)
    await assertCodeFree(tx, scope.tenantId, code)

    const [row] = await tx
      .insert(categories)
      .values({
        tenantId: scope.tenantId,
        name,
        code,
        description: parsed.data.description ?? null,
        parentId,
        active: parsed.data.active ?? true,
      })
      .onConflictDoNothing()
      .returning()

    if (!row) {
      const [again] = await tx
        .select()
        .from(categories)
        .where(and(eq(categories.tenantId, scope.tenantId), sameName(name)))
      if (again) return again
      throw conflict('a category with that name or code already exists')
    }

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'category.create',
        resourceType: 'category',
        resourceId: row.id,
        after: { name: row.name, code: row.code, parentId: row.parentId, active: row.active },
      },
      tx,
    )
    return row
  })
}

export async function updateCategory(input: unknown) {
  const scope = await requirePermission('product:write')
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('id and a new name are required')
  const name = normaliseName(parsed.data.name)
  const code = parsed.data.code ? parsed.data.code.trim() : null

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, parsed.data.id), eq(categories.tenantId, scope.tenantId)))
    if (!target) throw notFound('category not found')

    const [clash] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, scope.tenantId), sameName(name)))
    if (clash && clash.id !== target.id) throw conflict('a category with that name already exists')

    const parentId =
      parsed.data.parentId === undefined
        ? target.parentId
        : await resolveParent(tx, scope.tenantId, parsed.data.parentId, target.id)
    await assertCodeFree(tx, scope.tenantId, code, target.id)

    const [row] = await tx
      .update(categories)
      .set({
        name,
        code,
        description: parsed.data.description === undefined ? target.description : parsed.data.description,
        parentId,
        active: parsed.data.active === undefined ? target.active : parsed.data.active,
        updatedAt: new Date(),
      })
      .where(and(eq(categories.id, parsed.data.id), eq(categories.tenantId, scope.tenantId)))
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'category.update',
        resourceType: 'category',
        resourceId: parsed.data.id,
        before: {
          name: target.name,
          code: target.code,
          parentId: target.parentId,
          active: target.active,
        },
        after: { name: row.name, code: row.code, parentId: row.parentId, active: row.active },
      },
      tx,
    )
    return row
  })
}

export async function deleteCategory(id: string) {
  const scope = await requirePermission('product:write')
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [target] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, scope.tenantId)))
    if (!target) throw notFound('category not found')

    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.tenantId, scope.tenantId), eq(products.categoryId, id)))
    const [children] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(categories)
      .where(and(eq(categories.tenantId, scope.tenantId), eq(categories.parentId, id)))

    // Children move to the top level and products become uncategorised; both
    // keep their history and are never deleted with the category.
    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, scope.tenantId)))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'category.delete',
        resourceType: 'category',
        resourceId: id,
        before: {
          name: target.name,
          code: target.code,
          products: Number(used?.n ?? 0),
          children: Number(children?.n ?? 0),
        },
      },
      tx,
    )
    return {
      id,
      name: target.name,
      products: Number(used?.n ?? 0),
      children: Number(children?.n ?? 0),
    }
  })
}