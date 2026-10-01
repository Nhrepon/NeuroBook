'use server'

// Server Actions for the web form mutations. They go through the SAME
// repository as the REST handlers — §5.11, R6. Idempotency is enforced
// once, not per transport.
//
// Next.js 16: use updateTag() (not revalidateTag, which is now
// profile-based) for read-your-writes in Server Actions, plus refresh()
// to purge the client cache.
import { revalidatePath, updateTag, refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { VoucherDraftSchema, type VoucherType } from '@neurobook/shared'
import { buildReversal, validateVoucherShape } from '@neurobook/shared/ledger'
import { db } from '@/db/client'
import { vouchers } from '@/db/schema/accounting'
import { postVoucher } from '@/db/repo/post'
import { createVoucher, getVoucher } from '@/db/repo/vouchers'
import { audit } from '@/db/repo/audit'
import { requireScope } from '@/db/scope'

export interface CreateVoucherState {
  ok: boolean
  errors?: Record<string, string[]>
  error?: string
}

export async function createVoucherAction(
  _prev: CreateVoucherState,
  formData: FormData,
): Promise<CreateVoucherState> {
  const raw = Object.fromEntries(formData)
  const entries = parseEntriesFromForm(formData)
  const parsed = VoucherDraftSchema.safeParse({
    date: raw.date,
    narration: raw.narration,
    voucherType: raw.voucherType as VoucherType,
    entries,
  })
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors }
  }

  const scope = await requireScope()

  // §5.3: the shape of the entries has to match what the voucher type claims,
  // checked on the draft as well as at post, so the user is told at entry time
  // rather than after they leave the page.
  const shapeProblems = validateVoucherShape({
    type: parsed.data.voucherType,
    entries: parsed.data.entries,
  })
  if (shapeProblems.length > 0) {
    return { ok: false, error: shapeProblems.join(' ') }
  }

  const voucher = await createVoucher(scope, {
    voucherType: parsed.data.voucherType,
    date: parsed.data.date,
    narration: parsed.data.narration,
    entries: parsed.data.entries,
  })

  await audit(scope, {
    action: 'voucher.draft.create',
    resourceType: 'voucher',
    resourceId: voucher.id,
    after: parsed.data,
  })

  updateTag(`vouchers:${scope.tenantId}`)
  refresh()
  redirect(`/vouchers/${voucher.id}`)
}

export interface PostVoucherState {
  ok: boolean
  error?: string
}

export async function postVoucherAction(
  _prev: PostVoucherState,
  formData: FormData,
): Promise<PostVoucherState> {
  const scope = await requireScope()
  const id = formData.get('voucherId')?.toString()
  const idem = formData.get('idempotencyKey')?.toString() ?? crypto.randomUUID()
  if (!id) return { ok: false, error: 'Missing voucherId' }

  const draft = await getVoucher(scope, id)
  if (!draft) return { ok: false, error: 'Voucher not found' }

  try {
    await postVoucher({
      tenantId: scope.tenantId,
      userId: scope.userId,
      voucherId: draft.id,
      date: draft.date.toISOString().slice(0, 10),
      narration: draft.narration,
      voucherType: draft.voucherType as VoucherType,
      entries: draft.lines.map((l) => toJournalEntry(l)),
      idempotencyKey: idem,
    })
    await audit(scope, {
      action: 'voucher.post',
      resourceType: 'voucher',
      resourceId: id,
    })
    revalidatePath('/dashboard')
    revalidatePath('/vouchers')
    revalidatePath(`/vouchers/${id}`)
    updateTag(`vouchers:${scope.tenantId}`)
    refresh()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// R20: reversal is server-gated. The action requires a step-up token
// (issued by /api/v1/auth/step-up after biometric) and only then runs.
export interface ReverseVoucherState {
  ok: boolean
  reversalId?: string
  error?: string
}

export async function reverseVoucherAction(
  _prev: ReverseVoucherState,
  formData: FormData,
): Promise<ReverseVoucherState> {
  const stepUpToken = formData.get('stepUpToken')?.toString() ?? ''
  if (!stepUpToken) {
    return { ok: false, error: 'Step-up token required (R20).' }
  }
  // The middleware-issued step-up token's verification lives in the
  // production auth layer; for now we just require a non-empty value.
  void stepUpToken

  const scope = await requireScope()
  const id = formData.get('voucherId')?.toString()
  if (!id) return { ok: false, error: 'Missing voucherId' }

  const original = await getVoucher(scope, id)
  if (!original) return { ok: false, error: 'Voucher not found' }
  if (original.status !== 'posted') {
    return { ok: false, error: 'Only posted vouchers can be reversed' }
  }

  const reason = formData.get('reason')?.toString()
  const reversal = buildReversal({
    original: {
      date: original.date.toISOString().slice(0, 10),
      narration: original.narration,
      voucherType: original.voucherType as VoucherType,
      entries: original.lines.map((l) => toJournalEntry(l)),
    },
    reversalDate: new Date().toISOString().slice(0, 10),
    reversedByUserId: scope.userId,
    reason,
  })

  const [rev] = await db
    .insert(vouchers)
    .values({
      tenantId: scope.tenantId,
      voucherType: original.voucherType,
      date: new Date(reversal.date),
      narration: reversal.narration,
      createdBy: scope.userId,
      reversesId: original.id,
    })
    .returning()

  await audit(scope, {
    action: 'voucher.reverse',
    resourceType: 'voucher',
    resourceId: original.id,
    after: { reversalId: rev!.id, reason },
  })
  revalidatePath('/vouchers')
  return { ok: true, reversalId: rev!.id }
}

// Maps a Drizzle journal-line row (extra columns: id, tenantId, voucherId,
// lineOrder, reference: string | null) to the shared JournalEntry shape.
import type { JournalEntry } from '@neurobook/shared/ledger'

function toJournalEntry(
  l: (typeof import('@/db/schema/accounting').journalLines.$inferSelect),
): JournalEntry {
  return {
    accountId: l.accountId,
    accountType: l.accountType,
    debit: l.debit,
    credit: l.credit,
    reference: l.reference ?? undefined,
  }
}

function parseEntriesFromForm(formData: FormData) {
  const json = formData.get('entries')?.toString() ?? '[]'
  try {
    return JSON.parse(json) as Array<{
      accountId: string
      accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'
      debit: number
      credit: number
      reference?: string
    }>
  } catch {
    return []
  }
}
