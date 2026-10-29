import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { taxRates } from '@/lib/db/schema'
import { withTenant } from '@/lib/db/tenant'
import { requireScope } from '@/controllers/scope'
import { badRequest } from '@/controllers/errors'

const Schema = z.object({
  name: z.string().min(1),
  rate: z.number().int().nonnegative(),
  kind: z.string().optional(),
})

export async function getAllTaxRates() {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) =>
    tx.select().from(taxRates).where(eq(taxRates.tenantId, scope.tenantId)),
  )
}

export async function createTaxRate(input: unknown) {
  const scope = await requireScope()
  const parsed = Schema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(taxRates)
      .values({
        tenantId: scope.tenantId,
        name: parsed.data.name,
        rate: parsed.data.rate,
        kind: parsed.data.kind ?? 'vat',
      })
      .returning()
    return row
  })
}