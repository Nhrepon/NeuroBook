// GET /api/v1/invoices/:id/pdf — render + return the Mushak 6.2 PDF.
import { NextRequest } from 'next/server'
import { err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { getInvoice } from '@/db/repo/invoices'
import { db } from '@/db/client'
import { tenants } from '@/db/schema/tenant'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const scope = await requireScope()

  const invoice = await getInvoice(scope, id)
  if (!invoice) {
    return err({ code: 'NOT_FOUND', message: 'Invoice not found' }, 404)
  }

  const [company] = await db
    .select({ name: tenants.name, bin: tenants.bin, tin: tenants.tin, address: tenants.address })
    .from(tenants)
    .where(eq(tenants.id, scope.tenantId))

  const { renderMushak62Pdf } = await import('@/lib/pdf/mushak')
  const pdf = await renderMushak62Pdf(invoice, {
    name: company?.name ?? '—',
    bin: company?.bin,
    tin: company?.tin,
    address: company?.address,
  })

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="mushak62-${id.slice(0, 8)}.pdf"`,
    },
  })
}
