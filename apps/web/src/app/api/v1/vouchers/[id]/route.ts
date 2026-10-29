import { NextRequest } from 'next/server'
import { getVoucher, updateVoucher } from '@/controllers/voucherController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return run(() => getVoucher(id))
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await readBody(req)
  return run(() => updateVoucher(id, body))
}
