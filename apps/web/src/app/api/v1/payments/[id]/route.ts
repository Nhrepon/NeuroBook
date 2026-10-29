import { NextRequest } from 'next/server'
import { deletePayment } from '@/controllers/paymentController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return run(() => deletePayment(id))
}
