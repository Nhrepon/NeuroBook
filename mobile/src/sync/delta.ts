// Incremental pull — refresh the local read cache.
import { api } from '@/api/client'
import { upsertAccounts, upsertVouchers, type CachedAccount, type CachedVoucher } from '@/db/cache'
import { getCachedVoucher, listCachedVouchers } from '@/db/cache'

export async function pullDelta(since: number | null): Promise<{ accounts: number; vouchers: number }> {
  const params = since ? { since: new Date(since).toISOString() } : undefined
  const { data } = await api.get('/api/v1/sync/delta', { params })
  const accounts: CachedAccount[] = (data.data.accounts ?? []).map((a: { id: string; code: string; name: string; type: string; createdAt: string }) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    updated_at: new Date(a.createdAt).getTime(),
  }))
  const vouchers: CachedVoucher[] = (data.data.vouchers ?? []).map((v: { id: string; voucherType: string; date: string; narration: string; status: string; totalDebit: number; totalCredit: number; sequenceNumber: string | null; updatedAt: string }) => ({
    id: v.id,
    voucher_type: v.voucherType,
    date: v.date,
    narration: v.narration,
    status: v.status,
    total_debit: v.totalDebit,
    total_credit: v.totalCredit,
    sequence_number: v.sequenceNumber,
    updated_at: new Date(v.updatedAt).getTime(),
  }))
  if (accounts.length) await upsertAccounts(accounts)
  if (vouchers.length) await upsertVouchers(vouchers)
  return { accounts: accounts.length, vouchers: vouchers.length }
}

export { getCachedVoucher, listCachedVouchers }
