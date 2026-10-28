import { and, eq, sql } from 'drizzle-orm'
import { parties } from '@/db/schema'
import type { TenantTx } from '@/db/tenant'
import { z } from 'zod'

export const InvoiceLineSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  /** Unit price excluding VAT, in minor units. */
  unitPrice: z.number().int().nonnegative(),
  /** VAT rate in basis points (1500 = 15%). */
  vatRate: z.number().int().nonnegative().optional(),
})

export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>

export interface DerivedLine {
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  vatAmount: number
  total: number
}

/**
 * Turns item lines into persisted rows. Unit prices exclude VAT; VAT is added
 * on top, so the returned totals are the VAT-inclusive sums the header stores.
 */
export function deriveInvoiceLines(lines: InvoiceLineInput[]): {
  rows: DerivedLine[]
  total: number
  vat: number
} {
  let total = 0
  let vat = 0
  const rows = lines.map((l) => {
    const vatRate = l.vatRate ?? 0
    const base = l.quantity * l.unitPrice
    const vatAmount = Math.round((base * vatRate) / 10000)
    const lineTotal = base + vatAmount
    vat += vatAmount
    total += lineTotal
    return {
      productId: l.productId ?? null,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate,
      vatAmount,
      total: lineTotal,
    }
  })
  return { rows, total, vat }
}

/**
 * Resolves the party for an invoice. An explicit id wins; otherwise the name is
 * matched case-insensitively so repeated invoices do not create duplicates.
 */
export async function resolveCustomerId(
  tx: TenantTx,
  tenantId: string,
  customerId: string | undefined,
  customerName: string | undefined,
): Promise<string | undefined> {
  if (customerId) return customerId
  const name = customerName?.trim()
  if (!name) return undefined

  const [existing] = await tx
    .select({ id: parties.id })
    .from(parties)
    .where(and(eq(parties.tenantId, tenantId), sql`lower(${parties.name}) = lower(${name})`))
    .limit(1)
  if (existing) return existing.id

  const [created] = await tx
    .insert(parties)
    .values({ tenantId, name, type: 'CUSTOMER' })
    .returning({ id: parties.id })
  return created.id
}