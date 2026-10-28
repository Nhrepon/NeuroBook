import { NextRequest } from 'next/server'
import { db } from '@/db/client'
import { vouchers, journalLines } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { validateForPost } from '@neurobook/shared'

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
  const [v] = await db.select().from(vouchers).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
  if (!v) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
  const lines = await db.select().from(journalLines).where(eq(journalLines.voucherId, id))
  return Response.json({ data: { ...v, lines } })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: { code: 'VALIDATION', message: 'invalid input' } }, { status: 400 })

  const [v] = await db.select().from(vouchers).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId)))
  if (!v) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
  if (v.status !== 'draft') return Response.json({ error: { code: 'IMMUTABLE', message: 'only drafts can be edited' } }, { status: 409 })

  if (parsed.data.entries) {
    validateForPost({ entries: parsed.data.entries as any, status: 'draft' })
    await db.delete(journalLines).where(eq(journalLines.voucherId, id))
    await db.insert(journalLines).values(parsed.data.entries.map((e) => ({
      tenantId: scope.tenantId,
      voucherId: id,
      accountId: e.accountId,
      accountType: e.accountType,
      debit: e.debit,
      credit: e.credit,
      reference: e.reference ?? null,
    })))
  }

  const [updated] = await db.update(vouchers).set({
    date: parsed.data.date ? new Date(parsed.data.date) : v.date,
    narration: parsed.data.narration ?? v.narration,
    version: v.version + 1,
    updatedAt: new Date(),
  }).where(and(eq(vouchers.id, id), eq(vouchers.tenantId, scope.tenantId))).returning()

  return Response.json({ data: updated })
}
