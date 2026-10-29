import { NextRequest } from 'next/server'
import { getStockItem } from '@/controllers/stockController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return run(() => getStockItem(id))
}
