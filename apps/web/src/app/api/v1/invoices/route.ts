import { NextRequest } from 'next/server'
import { createInvoice, getAllInvoices } from '@/controllers/invoiceController'
import { readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllInvoices)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createInvoice(body), { status: 201 })
}
