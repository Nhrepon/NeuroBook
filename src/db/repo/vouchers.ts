// Voucher read queries + draft creation. Cursor pagination — U6 (100k+ rows).
import { db } from '../client'
import { vouchers, journalLines } from '../schema/index'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { JournalEntry } from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'
import type { RequestScope } from '../scope'

// R4: a draft's lines are validated at create time, not post time.
// The post trigger re-checks, so a bad draft can never be posted.
export async function createVoucher(
  scope: RequestScope,
  input: {
    voucherType: VoucherType
    date: string
    narration: string
    entries: JournalEntry[]
    /** R6: unique per tenant; a retry with the same key must not create a second voucher. */
    idempotencyKey?: string
  },
) {
  const totalDebit = input.entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = input.entries.reduce((s, e) => s + e.credit, 0)
  const [voucher] = await db
    .insert(vouchers)
    .values({
      tenantId: scope.tenantId,
      voucherType: input.voucherType,
      date: new Date(input.date),
      narration: input.narration,
      createdBy: scope.userId,
      idempotencyKey: input.idempotencyKey ?? null,
      totalDebit,
      totalCredit,
    })
    .returning()

  await db.insert(journalLines).values(
    input.entries.map((e, i) => ({
      tenantId: scope.tenantId,
      voucherId: voucher!.id,
      accountId: e.accountId,
      accountType: e.accountType,
      debit: e.debit,
      credit: e.credit,
      reference: e.reference ?? null,
      lineOrder: i,
    })),
  )
  return voucher!
}


export interface VoucherListInput {
  status?: 'draft' | 'posted' | 'reversed'
  /** §5.3: narrow the list to one voucher type. */
  type?: VoucherType
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export interface VoucherListItem {
  id: string
  date: string
  narration: string
  voucherType: string
  status: string
  totalDebit: number
  totalCredit: number
  sequenceNumber: string | null
  postedAt: string | null
  /**
   * The voucher's timestamp at full storage precision, used only as the keyset
   * sort key. Never display it — `date` is the display value.
   */
  dateCursor: string
}

/**
 * Keyset cursor for the voucher list.
 *
 * Rows are ordered by `(date DESC, id DESC)`. Ordering by `id` alone — as this
 * function used to — is meaningless here: `vouchers.id` defaults to
 * `gen_random_uuid()`, so `ORDER BY id DESC` returns a random order, which made
 * "recent vouchers" arbitrary and made cursor paging skip and repeat rows.
 *
 * The cursor carries the timestamp at microsecond precision, exactly as stored.
 * Round-tripping it through a JS Date would truncate it to milliseconds, and
 * every row inside that truncated sub-millisecond span would then be silently
 * skipped by the `(date, id) < (?, ?)` comparison — a dropped ledger row in an
 * accounting app is not an acceptable paging artefact.
 */
interface VoucherCursor {
  dateCursor: string
  id: string
}

function encodeCursor(item: { dateCursor: string; id: string }): string {
  return Buffer.from(`${item.dateCursor}|${item.id}`, 'utf8').toString('base64url')
}

function decodeCursor(raw: string): VoucherCursor | null {
  try {
    const [dateCursor, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
    if (!dateCursor || !id) return null
    if (Number.isNaN(new Date(dateCursor).getTime())) return null
    return { dateCursor, id }
  } catch {
    return null
  }
}

export async function listVouchers(
  scope: RequestScope,
  input: VoucherListInput,
): Promise<{ items: VoucherListItem[]; nextCursor: string | null }> {
  const limit = Math.min(input.limit ?? 50, 200)
  const conditions = [eq(vouchers.tenantId, scope.tenantId)]
  if (input.status) conditions.push(eq(vouchers.status, input.status))
  if (input.type) conditions.push(eq(vouchers.voucherType, input.type))
  if (input.from) conditions.push(sql`${vouchers.date} >= ${input.from}::timestamptz`)
  if (input.to) conditions.push(sql`${vouchers.date} <= ${input.to}::timestamptz`)
  if (input.cursor) {
    // An unparseable cursor is ignored rather than thrown, so a stale or
    // hand-edited link shows page 1 instead of a 500.
    const cursor = decodeCursor(input.cursor)
    if (cursor) {
      conditions.push(
        sql`(${vouchers.date}, ${vouchers.id}) < (${cursor.dateCursor}::timestamptz, ${cursor.id})`,
      )
    }
  }

  const rows = await db
    .select({
      id: vouchers.id,
      date: vouchers.date,
      narration: vouchers.narration,
      voucherType: vouchers.voucherType,
      status: vouchers.status,
      totalDebit: vouchers.totalDebit,
      totalCredit: vouchers.totalCredit,
      sequenceNumber: vouchers.sequenceNumber,
      postedAt: vouchers.postedAt,
      // Sort key at storage precision — see the cursor note above.
      dateCursor: sql<string>`to_char(${vouchers.date} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(vouchers)
    .where(and(...conditions))
    .orderBy(desc(vouchers.date), desc(vouchers.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
    ...r,
    date: r.date.toISOString(),
    postedAt: r.postedAt?.toISOString() ?? null,
  }))
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last) : null
  return { items, nextCursor }
}

export async function getVoucher(scope: RequestScope, id: string) {
  const [v] = await db
    .select()
    .from(vouchers)
    .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
  if (!v) return null
  const lines = await db
    .select()
    .from(journalLines)
    .where(and(eq(journalLines.voucherId, id), eq(journalLines.tenantId, scope.tenantId)))
    .orderBy(journalLines.lineOrder)
  return { ...v, lines }
}
