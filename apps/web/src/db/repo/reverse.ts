import type { TenantTx } from '../tenant'
import { vouchers, journalLines } from '../schema'
import { buildReversal } from '@neurobook/shared'
import { eq, and } from 'drizzle-orm'
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

  const lines = await tx.select().from(journalLines).where(eq(journalLines.voucherId, original.id))
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

  return { originalId: original.id, reversalId: draft.id, sequenceNumber: result.sequenceNumber }
}
