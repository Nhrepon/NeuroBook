import { NextRequest } from 'next/server'
import { ok, created, err } from '@/lib/envelope'
import { listVouchers, createVoucher } from '@/db/repo/vouchers'
import { requireScope } from '@/db/scope'
import { validateVoucherShape, isVoucherType } from '@neurobook/shared/ledger'
import { audit } from '@/db/repo/audit'
import { IdempotencyHeaderSchema, VoucherDraftSchema } from '@neurobook/shared'

// GET /api/v1/vouchers?status=&type=&from=&to=&cursor=&limit=
export async function GET(req: NextRequest) {
  const scope = await requireScope()
  const url = req.nextUrl
  const typeParam = url.searchParams.get('type') ?? undefined
  // An unknown type is ignored rather than 400'd: a stale `?type=` link should
  // show page 1 of everything, not an error. The filter list is the registry.
  const type = typeParam && isVoucherType(typeParam) ? typeParam : undefined
  const { items, nextCursor } = await listVouchers(scope, {
    status: (url.searchParams.get('status') ?? undefined) as 'draft' | 'posted' | 'reversed' | undefined,
    type,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: Number(url.searchParams.get('limit') ?? 50),
  })
  return ok(items, { cursor: nextCursor ?? undefined })
}

// POST /api/v1/vouchers — create a draft. R6: Idempotency-Key.
// VoucherDraftObject is the base z.object (no refine) so routes can extend
// or pick it. The full VoucherDraftSchema (with the balance refine) is the
// canonical parse for client-supplied payloads.
const CreateDraft = VoucherDraftSchema

export async function POST(req: NextRequest) {
  const scope = await requireScope()
  const idemKey = req.headers.get('idempotency-key')
  if (idemKey && !IdempotencyHeaderSchema.safeParse(idemKey).success) {
    return err({ code: 'VALIDATION', message: 'Invalid Idempotency-Key' }, 400)
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateDraft.safeParse(body)
  if (!parsed.success) {
    return err({ code: 'VALIDATION', message: 'Invalid input', field: 'entries' }, 400)
  }

  // §5.3 structural rules, so a client on an older version cannot post a
  // CONTRA that moves money between two expense accounts.
  const shapeProblems = validateVoucherShape({
    type: parsed.data.voucherType,
    entries: parsed.data.entries,
  })
  if (shapeProblems.length > 0) {
    return err({ code: 'VALIDATION', message: shapeProblems.join(' '), field: 'entries' }, 400)
  }

  // The lines are written with the draft, not at post time — otherwise a
  // client that never calls POST /:id/post has journal lines that arrive
  // after the header, and the balance trigger rejects them.
  const row = await createVoucher(scope, {
    voucherType: parsed.data.voucherType,
    date: parsed.data.date,
    narration: parsed.data.narration,
    entries: parsed.data.entries,
    ...(idemKey ? { idempotencyKey: idemKey } : {}),
  })

  await audit(scope, {
    action: 'voucher.draft.create',
    resourceType: 'voucher',
    resourceId: row.id,
    after: parsed.data,
  })
  return created(row)
}
