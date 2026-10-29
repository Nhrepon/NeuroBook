import { NextRequest } from 'next/server'
import { reverseVoucher } from '@/controllers/voucherController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await readBody(req)
  return run(() => reverseVoucher(id, body))
}
