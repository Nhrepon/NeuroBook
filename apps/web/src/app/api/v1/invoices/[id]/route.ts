import { NextRequest } from 'next/server'
import { getInvoice, updateInvoice } from '@/controllers/invoiceController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return run(() => getInvoice(id))
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await readBody(req)
  return run(() => updateInvoice(id, body))
}
