import { getReport } from '@/controllers/reportController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params
  return run(() => getReport(type))
}