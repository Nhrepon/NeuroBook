import { NextRequest } from 'next/server'
import { requireScope } from '@/db/scope'
import { reverseVoucher } from '@/db/repo/reverse'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const body = await req.json().catch(() => ({}))
  try {
    const result = await reverseVoucher({
      tenantId: scope.tenantId,
      userId: scope.userId,
      voucherId: id,
      idempotencyKey: body?.idempotencyKey,
    })
    return Response.json({ data: result }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message ?? 'INTERNAL'
    return Response.json({ error: { code: msg.startsWith('NOT_FOUND') ? 'NOT_FOUND' : 'VALIDATION', message: msg } }, { status: 400 })
  }
}
