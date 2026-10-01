// R3+R4+R6+R8: the atomic post path.
// One transaction: validate, reserve sequence, write header and lines, record
// idempotency. If anything throws, the whole thing rolls back and the
// sequence number is not consumed.
import { db, type DB } from '../client'
import { vouchers, journalLines, voucherSequences, idempotencyKeys, fiscalPeriods } from '../schema/index'
import { validateForPost, computeTotals, assertVoucherShape, voucherTypeSpec, type JournalEntry, type VoucherType } from '@neurobook/shared/ledger'
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

export interface PostVoucherResult {
  voucherId: string
  sequenceNumber: string
}

export async function postVoucher(input: PostVoucherInput): Promise<PostVoucherResult> {
  return db.transaction(async (tx) => {
    // 1. Pre-flight validation (R4).
    const totals = computeTotals({ entries: input.entries })
    validateForPost({
      entries: input.entries,
      status: 'draft',
    })
    // 1b. §5.3 structural check: the entries must also *mean* what this
    // voucher type claims. A CONTRA is bank-to-bank, so posting one against
    // two expense accounts is refused here rather than silently accepted. The
    // sequence number uses the type's short code (PAY, REC, JRN, ...) rather
    // than the raw enum, so the number reads the way an accountant expects.
    assertVoucherShape({ type: input.voucherType, entries: input.entries })

    // 2. R2: refuse if the period is closed.
    const fy = await resolveFiscalYear(tx, input.tenantId, input.date)
    const [period] = await tx
      .select()
      .from(fiscalPeriods)
      .where(and(eq(fiscalPeriods.tenantId, input.tenantId), eq(fiscalPeriods.label, fy.label)))
    if (period?.status === 'closed') {
      throw new Error('PERIOD_LOCKED: ' + fy.label)
    }

    // 3. R3: reserve the next sequence number, with a row lock.
    const [seq] = await tx
      .select()
      .from(voucherSequences)
      .where(
        and(
          eq(voucherSequences.tenantId, input.tenantId),
          eq(voucherSequences.voucherType, input.voucherType),
          eq(voucherSequences.fiscalYearLabel, fy.label),
        ),
      )
      .for('update')                  // SELECT … FOR UPDATE (R3)

    const nextNumber = (seq?.lastNumber ?? 0) + 1
    const sequenceNumber = formatSequenceNumber(input.voucherType, fy.label, nextNumber)

    if (seq) {
      // Match on the full sequence key (tenant + type + fiscal year), not the
      // tenant alone. Updating `where(tenant_id = ?)` bumped every type's and
      // every year's counter at once, so posting a JOURNAL in FY26-27 would
      // renumber PAY/REC vouchers and break the gapless sequence (R3).
      await tx
        .update(voucherSequences)
        .set({ lastNumber: nextNumber })
        .where(
          and(
            eq(voucherSequences.tenantId, input.tenantId),
            eq(voucherSequences.voucherType, input.voucherType),
            eq(voucherSequences.fiscalYearLabel, fy.label),
          ),
        )
    } else {
      await tx.insert(voucherSequences).values({
        tenantId: input.tenantId,
        voucherType: input.voucherType,
        fiscalYearLabel: fy.label,
        lastNumber: nextNumber,
      })
    }

    // 4. Update the voucher header to posted (R1 immutability is enforced by trigger).
    const [posted] = await tx
      .update(vouchers)
      .set({
        status: 'posted',
        sequenceNumber,
        fiscalPeriodLabel: fy.label,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        postedBy: input.userId,
        postedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${vouchers.version} + 1`,
      })
      .where(and(eq(vouchers.id, input.voucherId), eq(vouchers.tenantId, input.tenantId)))
      .returning()
    if (!posted) throw new Error('Voucher not found or wrong tenant.')

    // 5. Journal lines are normally written at draft-creation. If the
    //    voucher has no lines yet (e.g. a bare header from the mobile
    //    sync path), insert them from the input. The trigger recomputes
    //    Σdebit/Σcredit from the lines and rejects any disagreement with
    //    the header (R4).
    const [lineCount] = await tx
      .select({ n: sql<number>`count(*)` })
      .from(journalLines)
      .where(
        and(eq(journalLines.tenantId, input.tenantId), eq(journalLines.voucherId, input.voucherId)),
      )
    if ((lineCount?.n ?? 0) === 0) {
      await tx.insert(journalLines).values(
        input.entries.map((e, i) => ({
          tenantId: input.tenantId,
          voucherId: input.voucherId,
          accountId: e.accountId,
          accountType: e.accountType,
          debit: e.debit,
          credit: e.credit,
          reference: e.reference ?? null,
          lineOrder: i,
        })),
      )
    }

    // 6. R6: record the idempotency response for 24h.
    if (input.idempotencyKey) {
      await tx.insert(idempotencyKeys).values({
        tenantId: input.tenantId,
        key: input.idempotencyKey,
        voucherId: input.voucherId,
        responseJson: JSON.stringify({ voucherId: input.voucherId, sequenceNumber }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
    }

    return { voucherId: input.voucherId, sequenceNumber }
  })
}

async function resolveFiscalYear(
  tx: Parameters<Parameters<DB['transaction']>[0]>[0],
  _tenantId: string,
  date: string,
): Promise<{ label: string; start: Date; end: Date }> {
  // In production, this looks up the fiscal_periods row for the date.
  // For now, derive a label from the date (NBR FY 1 Jul – 30 Jun, U3).
  const d = new Date(date)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const startYear = m >= 6 ? y : y - 1
  const label = `FY ${startYear}-${String(startYear + 1).slice(-2)}`
  return {
    label,
    start: new Date(Date.UTC(startYear, 6, 1)),
    end: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59)),
  }
}

// Sequence numbers read the way an accountant expects: PAY/FY 26-27/000001,
// not PAYMENT/FY 26-27/000001. The short code is per-type and fixed, so the
// sequence stays gapless and sortable.
function formatSequenceNumber(type: VoucherType, fyLabel: string, n: number): string {
  const short = voucherTypeSpec(type).shortCode
  return `${short}/${fyLabel}/${String(n).padStart(6, '0')}`
}
