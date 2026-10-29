import type { TenantTx } from '../tenant'
import { vouchers, journalLines, voucherSequences, idempotencyKeys, fiscalPeriods } from '../schema'
import { validateForPost, computeTotals, assertVoucherShape, type JournalEntry, type VoucherType } from '@neurobook/shared'
import { sql, and, eq } from 'drizzle-orm'

export interface PostVoucherInput {
  tenantId: string
  userId: string
  voucherId: string
  date: string
  narration: string
  voucherType: VoucherType
  entries: JournalEntry[]
  idempotencyKey?: string
}

export interface PostVoucherResult { voucherId: string; sequenceNumber: string }

function resolveFiscalYear(date: string): { label: string } {
  const d = new Date(date)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  // NBR fiscal year: 1 July – 30 June
  const startYear = m >= 7 ? y : y - 1
  return { label: `FY ${startYear}-${String(startYear + 1).slice(2)}` }
}

/**
 * Posts a voucher. Must run inside the caller's tenant transaction (`withTenant`)
 * so the sequence, lines, and idempotency key commit atomically under RLS.
 */
export async function postVoucher(input: PostVoucherInput, tx: TenantTx): Promise<PostVoucherResult> {
  if (input.idempotencyKey) {
    const [existing] = await tx.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.tenantId, input.tenantId), eq(idempotencyKeys.key, input.idempotencyKey)))
    if (existing?.response) {
      return existing.response as PostVoucherResult
    }
  }

  validateForPost({ entries: input.entries, status: 'draft' })
  assertVoucherShape({ type: input.voucherType, entries: input.entries })
  const totals = computeTotals(input.entries)

  const fy = resolveFiscalYear(input.date)
  const [period] = await tx.select().from(fiscalPeriods).where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.label, fy.label)))
  if (period?.status === 'closed') throw new Error('PERIOD_LOCKED: ' + fy.label)

  const [seq] = await tx.select().from(voucherSequences).where(and(
    eq(voucherSequences.tenantId, input.tenantId),
    eq(voucherSequences.voucherType, input.voucherType),
    eq(voucherSequences.fiscalYearLabel, fy.label),
  )).for('update')

  const nextNumber = (seq?.lastNumber ?? 0) + 1
  const sequenceNumber = `${input.voucherType}/${fy.label}/${String(nextNumber).padStart(6, '0')}`

  if (seq) {
    await tx.update(voucherSequences).set({ lastNumber: nextNumber }).where(and(
      eq(voucherSequences.tenantId, input.tenantId),
      eq(voucherSequences.voucherType, input.voucherType),
      eq(voucherSequences.fiscalYearLabel, fy.label),
    ))
  } else {
    await tx.insert(voucherSequences).values({
      tenantId: input.tenantId,
      voucherType: input.voucherType,
      fiscalYearLabel: fy.label,
      lastNumber: nextNumber,
    })
  }

  await tx.update(vouchers).set({
    status: 'posted',
    version: sql`${vouchers.version} + 1`,
    sequenceNumber,
    narration: input.narration,
    date: new Date(input.date),
  }).where(and(eq(vouchers.id, input.voucherId), eq(vouchers.tenantId, input.tenantId)))

  await tx.delete(journalLines).where(eq(journalLines.voucherId, input.voucherId))
  await tx.insert(journalLines).values(input.entries.map((e) => ({
    tenantId: input.tenantId,
    voucherId: input.voucherId,
    accountId: e.accountId,
    accountType: e.accountType,
    debit: e.debit,
    credit: e.credit,
    reference: e.reference ?? null,
  })))

  const result: PostVoucherResult = { voucherId: input.voucherId, sequenceNumber }

  if (input.idempotencyKey) {
    await tx.insert(idempotencyKeys).values({
      tenantId: input.tenantId,
      key: input.idempotencyKey,
      response: result as any,
    })
  }

  void totals
  return result
}
