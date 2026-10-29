import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { accounts } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const CreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().uuid().optional(),
  isGroup: z.boolean().optional(),
  openingBalance: z.number().int().optional(),
})

export async function getAllAccounts() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(accounts).where(eq(accounts.tenantId, scope.tenantId)),
  )
}

export async function createAccount(input: unknown) {
  const scope = await requireScope()
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({
        tenantId: scope.tenantId,
        name: parsed.data.name,
        code: parsed.data.code,
        type: parsed.data.type,
        parentId: parsed.data.parentId ?? null,
        isGroup: parsed.data.isGroup ?? false,
        openingBalance: parsed.data.openingBalance ?? 0,
      })
      .returning()
    return row
  })
}