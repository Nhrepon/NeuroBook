import { vouchers, journalLines } from '@/lib/db/schema'
import { requireScope, ForbiddenError } from '@/controllers/scope'
import { withTenant } from '@/lib/db/tenant'
import { postVoucher as postVoucherRepo } from '@/lib/db/repo/post'
import { reverseVoucher as reverseVoucherRepo } from '@/lib/db/repo/reverse'
import { writeAudit } from '@/lib/db/audit'
import { badRequest, notFound, conflict } from '@/controllers/errors'
import { VoucherTypeSchema, can, voucherTypePermission, validateForPost, type VoucherType } from '@neurobook/shared'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const CreateSchema = z.object({
  date: z.string(),
  narration: z.string().min(1),
  voucherType: VoucherTypeSchema,
})

const EntrySchema = z.object({
  accountId: z.string().uuid(),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  debit: z.number().int().nonnegative(),
  credit: z.number().int().nonnegative(),
  reference: z.string().optional(),
})

const UpdateSchema = z.object({
  date: z.string().optional(),
  narration: z.string().optional(),
  entries: z.array(EntrySchema).optional(),
})

const PostSchema = z.object({
  date: z.string(),
  narration: z.string(),
  voucherType: z.string(),
  entries: z.array(EntrySchema),
  idempotencyKey: z.string().optional(),
})

export async function getAllVouchers(type?: string | null) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const rows = await tx.select().from(vouchers).where(eq(vouchers.tenantId, scope.tenantId))
    return type ? rows.filter((r) => r.voucherType === type) : rows
  })
}

export async function createVoucher(input: unknown) {
  const scope = await requireScope()
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')
  if (!can(scope.role, voucherTypePermission(parsed.data.voucherType))) throw new ForbiddenError()

  return withTenant(scope.tenantId, async (tx) => {
    const [row] = await tx
      .insert(vouchers)
      .values({
        tenantId: scope.tenantId,
        date: new Date(parsed.data.date),
        narration: parsed.data.narration,
        voucherType: parsed.data.voucherType,
        createdBy: scope.userId,
      })
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'voucher.create',
        resourceType: 'voucher',
        resourceId: row.id,
        after: { voucherType: row.voucherType, date: row.date, narration: row.narration },
      },
      tx,
    )

    return row
  })
}

export async function getVoucher(id: string) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const [v] = await tx
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!v) throw notFound('not found')
    const lines = await tx
      .select()
      .from(journalLines)
      .where(and(eq(journalLines.voucherId, id), eq(journalLines.tenantId, scope.tenantId)))
    return { ...v, lines }
  })
}

export async function updateVoucher(id: string, input: unknown) {
  const scope = await requireScope()
  const parsed = UpdateSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [v] = await tx
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!v) throw notFound('not found')
    if (!can(scope.role, voucherTypePermission(v.voucherType as VoucherType))) throw new ForbiddenError()
    if (v.status !== 'draft') throw conflict('only drafts can be edited')

    if (parsed.data.entries) {
      validateForPost({ entries: parsed.data.entries as any, status: 'draft' })
      await tx
        .delete(journalLines)
        .where(and(eq(journalLines.voucherId, id), eq(journalLines.tenantId, scope.tenantId)))
      await tx.insert(journalLines).values(
        parsed.data.entries.map((e) => ({
          tenantId: scope.tenantId,
          voucherId: id,
          accountId: e.accountId,
          accountType: e.accountType,
          debit: e.debit,
          credit: e.credit,
          reference: e.reference ?? null,
        })),
      )
    }

    const [updated] = await tx
      .update(vouchers)
      .set({
        date: parsed.data.date ? new Date(parsed.data.date) : v.date,
        narration: parsed.data.narration ?? v.narration,
        version: v.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
      .returning()

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'voucher.update',
        resourceType: 'voucher',
        resourceId: id,
        before: { date: v.date, narration: v.narration, version: v.version },
        after: { date: updated.date, narration: updated.narration, version: updated.version },
      },
      tx,
    )

    return updated
  })
}

export async function postVoucher(id: string, input: unknown) {
  const scope = await requireScope()
  const parsed = PostSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invalid input')

  return withTenant(scope.tenantId, async (tx) => {
    const [draft] = await tx
      .select()
      .from(vouchers)
      .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!draft) throw notFound('voucher not found')
    if (!can(scope.role, voucherTypePermission(draft.voucherType as VoucherType))) throw new ForbiddenError()

    const result = await postVoucherRepo(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        voucherId: id,
        date: parsed.data.date,
        narration: parsed.data.narration,
        voucherType: parsed.data.voucherType as VoucherType,
        entries: parsed.data.entries as any,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      tx,
    )

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'voucher.post',
        resourceType: 'voucher',
        resourceId: id,
        after: result,
      },
      tx,
    )

    return result
  })
}

export async function reverseVoucher(id: string, input: unknown) {
  const scope = await requireScope()
  const body = (input ?? {}) as { idempotencyKey?: unknown }
  if (body.idempotencyKey !== undefined && typeof body.idempotencyKey !== 'string') {
    throw badRequest('invalid idempotencyKey')
  }

  return withTenant(scope.tenantId, async (tx) => {
    const [existing] = await tx
      .select({ voucherType: vouchers.voucherType })
      .from(vouchers)
      .where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!existing) throw notFound('voucher not found')
    if (!can(scope.role, voucherTypePermission(existing.voucherType as VoucherType))) throw new ForbiddenError()

    const result = await reverseVoucherRepo(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        voucherId: id,
        idempotencyKey: body.idempotencyKey as string | undefined,
      },
      tx,
    )

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'voucher.reverse',
        resourceType: 'voucher',
        resourceId: id,
        after: result,
      },
      tx,
    )

    return result
  })
}
