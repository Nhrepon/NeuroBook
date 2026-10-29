import type { TenantTx } from '../tenant'
import { vouchers, journalLines, invoices, stockMovements } from '../schema'
import { buildReversal } from '@neurobook/shared'
import { eq, and, inArray } from 'drizzle-orm'
import { postVoucher } from './post'

export async function reverseVoucher(input: {
  tenantId: string
  userId: string
  voucherId: string
  idempotencyKey?: string
}, tx: TenantTx): Promise<{ originalId: string; reversalId: string; sequenceNumber: string }> {
  const [original] = await tx.select().from(vouchers).where(and(eq(vouchers.id, input.voucherId), eq(vouchers.tenantId, input.tenantId)))
  if (!original) throw new Error('NOT_FOUND')
  if (original.status !== 'posted') throw new Error('IMMUTABLE: only posted vouchers can be reversed')
  if (original.reversedById) throw new Error('CONFLICT: this voucher has already been reversed')

  const lines = await tx.select().from(journalLines).where(eq(journalLines.voucherId, original.id))
  if (lines.length === 0) throw new Error('VALIDATION: a posted voucher with no lines cannot be reversed')
  const entries = lines.map((l) => ({
    accountId: l.accountId,
    accountType: l.accountType as any,
    debit: l.debit,
    credit: l.credit,
    reference: l.reference ?? undefined,
  }))

  const rev = buildReversal({
    date: original.date.toISOString().slice(0, 10),
    narration: original.narration,
    voucherType: original.voucherType as any,
    entries,
  })

  const [draft] = await tx.insert(vouchers).values({
    tenantId: input.tenantId,
    date: new Date(rev.date),
    narration: rev.narration,
    voucherType: rev.voucherType,
    status: 'draft',
    createdBy: input.userId,
    reversesId: original.id,
  }).returning()

  const result = await postVoucher({
    tenantId: input.tenantId,
    userId: input.userId,
    voucherId: draft.id,
    date: rev.date,
    narration: rev.narration,
    voucherType: rev.voucherType,
    entries: rev.entries,
    idempotencyKey: input.idempotencyKey,
  }, tx)

  await tx.update(vouchers).set({
    status: 'reversed',
    reversedById: draft.id,
  }).where(and(eq(vouchers.id, original.id), eq(vouchers.tenantId, input.tenantId)))

  // If the voucher came from an invoice, the goods must come back too: mirror
  // the stock ledger and close the invoice, so books and stock stay in step.
  const linked = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.voucherId, original.id)))
  if (linked.length > 0) {
    const moves = await tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, input.tenantId), eq(stockMovements.voucherId, original.id)))
    const mirrored = moves
      .filter((m) => m.type === 'in' || m.type === 'out')
      .map((m) => ({
        tenantId: m.tenantId,
        productId: m.productId,
        warehouseId: m.warehouseId,
        voucherId: draft.id,
        date: original.date,
        quantity: m.quantity,
        unitCost: m.unitCost,
        type: m.type === 'in' ? ('out' as const) : ('in' as const),
        reference: `reversal of ${m.reference ?? original.sequenceNumber ?? original.id}`,
      }))
    if (mirrored.length > 0) await tx.insert(stockMovements).values(mirrored)

    await tx
      .update(invoices)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(invoices.tenantId, input.tenantId),
          inArray(invoices.id, linked.map((l) => l.id)),
        ),
      )
  }

  return { originalId: original.id, reversalId: draft.id, sequenceNumber: result.sequenceNumber }
}
