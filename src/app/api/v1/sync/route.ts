import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err } from '@/lib/envelope'
import { requireScope } from '@/db/scope'
import { createVoucher } from '@/db/repo/vouchers'
import { validateVoucherShape } from '@neurobook/shared/ledger'
import { audit } from '@/db/repo/audit'
import { VoucherDraftSchema } from '@neurobook/shared'

// POST /api/v1/sync — batch upload of the mobile offline queue (§3.2.1, §15.3).
// Each item is processed independently so one failure does not block the rest.
const Item = z.object({
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  resource: z.enum(['voucher', 'account', 'payment']),
  payload: z.unknown(),
  clientId: z.string(),   // client-generated id; the server returns the map.
  createdAt: z.number(),
})

const Body = z.object({
  items: z.array(Item),
})

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const body = await req.json().catch(() => null)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid sync batch' }, 400)
  }

  const results: Array<{ clientId: string; status: 'ok' | 'conflict' | 'error'; serverId?: string; error?: string }> = []
  for (const item of parsed.data.items) {
    try {
      if (item.resource === 'voucher' && item.operation === 'CREATE') {
        // A queued draft is held for hours or days before it syncs, so it must
        // be re-validated on arrival rather than trusted: the queue can have
        // been written by an older client, and offline it was validated against
        // whatever the chart looked like on the phone, not the server.
        const p = VoucherDraftSchema.safeParse(item.payload)
        if (!p.success) {
          results.push({
            clientId: item.clientId,
            status: 'error',
            error: 'Invalid voucher payload',
          })
          continue
        }
        const shapeProblems = validateVoucherShape({
          type: p.data.voucherType,
          entries: p.data.entries,
        })
        if (shapeProblems.length > 0) {
          results.push({
            clientId: item.clientId,
            status: 'error',
            error: shapeProblems.join(' '),
          })
          continue
        }
        // Through createVoucher, not a bare insert: the journal lines and the
        // totals have to land with the header. A header with no lines is not a
        // draft, it is a voucher that can never post.
        const row = await createVoucher(scope, {
          voucherType: p.data.voucherType,
          date: p.data.date,
          narration: p.data.narration,
          entries: p.data.entries,
          idempotencyKey: item.clientId,
        })
        results.push({ clientId: item.clientId, status: 'ok', serverId: row.id })
        continue
      }
      results.push({ clientId: item.clientId, status: 'error', error: 'Unsupported operation' })
    } catch (e) {
      results.push({ clientId: item.clientId, status: 'error', error: (e as Error).message })
    }
  }

  await audit(scope, {
    action: 'sync.batch',
    resourceType: 'sync',
    after: { count: results.length, ok: results.filter((r) => r.status === 'ok').length },
  })
  return ok({ results })
}
