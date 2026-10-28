import { NextRequest } from 'next/server'
import { vouchers, journalLines } from '@/db/schema'
import { requireScope, forbiddenResponse } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { writeAudit } from '@/lib/audit'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { validateForPost, can, voucherTypePermission, type VoucherType } from '@neurobook/shared'

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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()

  return withTenant(scope.tenantId, async (tx) => {
    const [v] = await tx.select().from(vouchers).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!v) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
    const lines = await tx.select().from(journalLines).where(and(eq(journalLines.voucherId, id), eq(journalLines.tenantId, scope.tenantId)))
    return Response.json({ data: { ...v, lines } })
  })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  return withTenant(scope.tenantId, async (tx) => {
    const [v] = await tx.select().from(vouchers).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
    if (!v) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
    if (!can(scope.role, voucherTypePermission(v.voucherType as VoucherType))) return forbiddenResponse()
    if (v.status !== 'draft') return Response.json({ error: { code: 'IMMUTABLE', message: 'only drafts can be edited' } }, { status: 409 })

    if (parsed.data.entries) {
      validateForPost({ entries: parsed.data.entries as any, status: 'draft' })
      await tx.delete(journalLines).where(and(eq(journalLines.voucherId, id), eq(journalLines.tenantId, scope.tenantId)))
      await tx.insert(journalLines).values(parsed.data.entries.map((e) => ({
        tenantId: scope.tenantId,
        voucherId: id,
        accountId: e.accountId,
        accountType: e.accountType,
        debit: e.debit,
        credit: e.credit,
        reference: e.reference ?? null,
      })))
    }

    const [updated] = await tx.update(vouchers).set({
      date: parsed.data.date ? new Date(parsed.data.date) : v.date,
      narration: parsed.data.narration ?? v.narration,
      version: v.version + 1,
      updatedAt: new Date(),
    }).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId))).returning()

    await writeAudit({
      tenantId: scope.tenantId,
      userId: scope.userId,
      action: 'voucher.update',
      resourceType: 'voucher',
      resourceId: id,
      before: { date: v.date, narration: v.narration, version: v.version },
      after: { date: updated.date, narration: updated.narration, version: updated.version },
    }, tx)

    return Response.json({ data: updated })
  })
}
