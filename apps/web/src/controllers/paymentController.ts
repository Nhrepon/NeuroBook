import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { accounts, invoices, parties, payments, vouchers } from '@/lib/db/schema'
import { withTenant, type TenantTx } from '@/lib/db/tenant'
import { writeAudit } from '@/lib/db/audit'
import { postVoucher, assertEntriesBookable } from '@/lib/db/repo/post'
import { reverseVoucher } from '@/lib/db/repo/reverse'
import { ForbiddenError, requireScope } from '@/controllers/scope'
import { badRequest, conflict, notFound } from '@/controllers/errors'
import { can, type JournalEntry } from '@neurobook/shared'

const DateOnlySchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date')

const METHOD = z.enum(['cash', 'bank', 'mobile', 'cheque', 'card', 'transfer', 'other'])

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  /** Amount received/paid, in minor units. */
  amount: z.number().int().positive(),
  /** The cash/bank asset ledger the money moved through. */
  accountId: z.string().uuid(),
  method: METHOD.optional(),
  date: DateOnlySchema.optional(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
})

/** The account a settlement credits (cash out) or debits (cash in). */
async function resolveSettlementAccount(tx: TenantTx, tenantId: string, accountId: string) {
  const [account] = await tx
    .select({ id: accounts.id, type: accounts.type, active: accounts.active })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.tenantId, tenantId)))
  if (!account) throw badRequest('the settlement account does not belong to this company')
  if (!account.active) throw badRequest('the settlement account is inactive')
  if (account.type !== 'ASSET') throw badRequest('money must settle through an asset account (cash or bank)')
  return account
}

/** Finds the default ledger for a code, falling back to the first of a type. */
async function resolveByCode(
  tx: TenantTx,
  tenantId: string,
  code: string,
  type: 'ASSET' | 'LIABILITY',
  excludeId?: string,
) {
  const rows = await tx
    .select({ id: accounts.id, code: accounts.code, type: accounts.type, isGroup: accounts.isGroup, active: accounts.active })
    .from(accounts)
    .where(eq(accounts.tenantId, tenantId))
  const usable = rows.filter((a) => !a.isGroup && a.active && a.id !== excludeId)
  return usable.find((a) => a.code === code && a.type === type) ?? usable.find((a) => a.type === type)
}

async function paidTotal(tx: TenantTx, tenantId: string, invoiceId: string) {
  const rows = await tx
    .select({ amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.tenantId, tenantId), eq(payments.invoiceId, invoiceId)))
  return rows.reduce((sum, r) => sum + r.amount, 0)
}

function statusFor(paid: number, total: number) {
  if (paid >= total) return 'paid'
  return paid > 0 ? 'partially_paid' : 'sent'
}

/** Money in and out recorded against invoices, with the linked voucher. */
export async function getAllPayments(invoiceId?: string | null) {
  const scope = await requireScope()
  return withTenant(scope.tenantId, async (tx) => {
    const conds = [eq(payments.tenantId, scope.tenantId)]
    if (invoiceId) conds.push(eq(payments.invoiceId, invoiceId))
    const rows = await tx
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        voucherId: payments.voucherId,
        amount: payments.amount,
        direction: payments.direction,
        method: payments.method,
        reference: payments.reference,
        notes: payments.notes,
        paidAt: payments.paidAt,
        invoiceNumber: invoices.number,
        invoiceType: invoices.type,
        party: parties.name,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(parties, eq(payments.partyId, parties.id))
      .where(and(...conds))
      .orderBy(desc(payments.paidAt))
    return rows
  })
}

/**
 * Records a settlement against an invoice. A sale invoice takes money in (a
 * receipt voucher debits cash and credits the receivable); a purchase invoice
 * pays money out (a payment voucher debits the payable and credits cash). The
 * invoice's status follows the money: sent -> partially_paid -> paid.
 */
export async function recordPayment(input: unknown) {
  const scope = await requireScope()
  const parsed = RecordPaymentSchema.safeParse(input)
  if (!parsed.success) throw badRequest('invoiceId, a positive amount and a settlement account are required')

  return withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, parsed.data.invoiceId), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) throw notFound('invoice not found')
    if (invoice.status === 'draft') throw conflict('post the invoice before settling it')
    if (invoice.status === 'cancelled') throw conflict('a cancelled invoice cannot be settled')

    const isReceipt = invoice.type === 'sale'
    const direction = isReceipt ? 'in' : 'out'
    if (!can(scope.role, isReceipt ? 'receipt:write' : 'payment:write')) throw new ForbiddenError()

    const account = await resolveSettlementAccount(tx, scope.tenantId, parsed.data.accountId)

    const paid = await paidTotal(tx, scope.tenantId, invoice.id)
    const outstanding = invoice.total - paid
    if (outstanding <= 0) throw conflict('this invoice is already fully paid')
    if (parsed.data.amount > outstanding) {
      throw badRequest(`the amount exceeds the ${outstanding} outstanding on this invoice`)
    }

    const counterCode = isReceipt ? '1200' : '2200'
    const counterType = isReceipt ? 'ASSET' : 'LIABILITY'
    const counter = await resolveByCode(tx, scope.tenantId, counterCode, counterType, account.id)
    if (!counter) {
      throw badRequest(`no ${isReceipt ? 'receivable' : 'payable'} account found; set one up first`)
    }

    const entries: JournalEntry[] = isReceipt
      ? [
          { accountId: account.id, accountType: 'ASSET', debit: parsed.data.amount, credit: 0 },
          { accountId: counter.id, accountType: counter.type as JournalEntry['accountType'], debit: 0, credit: parsed.data.amount },
        ]
      : [
          { accountId: counter.id, accountType: counter.type as JournalEntry['accountType'], debit: parsed.data.amount, credit: 0 },
          { accountId: account.id, accountType: 'ASSET', debit: 0, credit: parsed.data.amount },
        ]
    await assertEntriesBookable(scope.tenantId, entries, tx)

    const narration = `${isReceipt ? 'Receipt' : 'Payment'} against invoice ${invoice.number ?? invoice.id.slice(0, 8)}`
    const [draft] = await tx
      .insert(vouchers)
      .values({
        tenantId: scope.tenantId,
        date: new Date(parsed.data.date ?? new Date()),
        narration,
        voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
        status: 'draft',
        createdBy: scope.userId,
      })
      .returning()

    const posted = await postVoucher(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        voucherId: draft.id,
        date: (parsed.data.date ?? new Date().toISOString().slice(0, 10)),
        narration,
        voucherType: isReceipt ? 'RECEIPT' : 'PAYMENT',
        entries,
      },
      tx,
    )

    const [row] = await tx
      .insert(payments)
      .values({
        tenantId: scope.tenantId,
        invoiceId: invoice.id,
        voucherId: draft.id,
        partyId: invoice.customerId ?? null,
        amount: parsed.data.amount,
        direction,
        method: parsed.data.method ?? 'cash',
        reference: parsed.data.reference ?? null,
        notes: parsed.data.notes ?? null,
        paidAt: new Date(parsed.data.date ?? new Date()),
      })
      .returning()

    const nextPaid = paid + parsed.data.amount
    const nextStatus = statusFor(nextPaid, invoice.total)
    await tx
      .update(invoices)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, scope.tenantId)))

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: isReceipt ? 'payment.receipt' : 'payment.payment',
        resourceType: 'invoice',
        resourceId: invoice.id,
        after: {
          paymentId: row.id,
          voucherId: draft.id,
          sequenceNumber: posted.sequenceNumber,
          amount: parsed.data.amount,
          direction,
          status: nextStatus,
        },
      },
      tx,
    )

    return { payment: row, sequenceNumber: posted.sequenceNumber, paid: nextPaid, status: nextStatus }
  })
}

/**
 * Undoes a recorded settlement: the linked voucher is reversed so the ledger
 * nets to zero, then the payment is removed and the invoice status recalculated.
 */
export async function deletePayment(id: string) {
  const scope = await requireScope()
  if (!id) throw badRequest('id is required')

  return withTenant(scope.tenantId, async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.tenantId, scope.tenantId)))
    if (!payment) throw notFound('payment not found')

    const isReceipt = payment.direction === 'in'
    if (!can(scope.role, isReceipt ? 'receipt:write' : 'payment:write')) throw new ForbiddenError()

    if (payment.voucherId) {
      const [voucher] = await tx
        .select({ status: vouchers.status })
        .from(vouchers)
        .where(eq(vouchers.id, payment.voucherId))
      if (voucher?.status === 'posted') {
        await reverseVoucher(
          { tenantId: scope.tenantId, userId: scope.userId, voucherId: payment.voucherId },
          tx,
        )
      }
    }

    await tx.delete(payments).where(and(eq(payments.id, id), eq(payments.tenantId, scope.tenantId)))

    let status: string | null = null
    if (payment.invoiceId) {
      const [invoice] = await tx
        .select({ total: invoices.total, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.id, payment.invoiceId), eq(invoices.tenantId, scope.tenantId)))
      if (invoice && invoice.status !== 'cancelled') {
        const paid = await paidTotal(tx, scope.tenantId, payment.invoiceId)
        status = statusFor(paid, invoice.total)
        await tx
          .update(invoices)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(invoices.id, payment.invoiceId), eq(invoices.tenantId, scope.tenantId)))
      }
    }

    await writeAudit(
      {
        tenantId: scope.tenantId,
        userId: scope.userId,
        action: 'payment.delete',
        resourceType: 'payment',
        resourceId: id,
        before: { invoiceId: payment.invoiceId, amount: payment.amount, direction: payment.direction },
        after: { invoiceStatus: status },
      },
      tx,
    )

    return { id, status }
  })
}
