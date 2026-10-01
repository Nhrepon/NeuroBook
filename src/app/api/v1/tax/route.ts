// Phase 3 — VAT/TDS/Mushak forms. Stub.
import { NextRequest } from 'next/server'
import { ok } from '@/lib/envelope'
import { requireScope } from '@/db/scope'

export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const type = req.nextUrl.searchParams.get('type') ?? 'vat-summary'
  void scope
  return ok({ type, rows: [] })
}
