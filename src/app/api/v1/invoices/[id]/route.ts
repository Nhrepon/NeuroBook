// GET /api/v1/invoices/:id
import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { getInvoice } from '@/db/repo/invoices'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const scope = await requireScope()
  const row = await getInvoice(scope, id)
  if (!row) return err({ code: 'NOT_FOUND', message: 'Invoice not found' }, 404)
  return ok(row)
}
