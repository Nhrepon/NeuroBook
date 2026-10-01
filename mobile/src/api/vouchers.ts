// R6: Idempotency-Key on every mutation. R21: post is never queued —
// only draft creates/edits live in the queue.
import { api } from './client'
import { z } from 'zod'
import { VoucherDraftSchema } from '@neurobook/shared'

export const getVouchers = async (params?: { status?: string; cursor?: string; limit?: number }) => {
  const { data } = await api.get('/api/v1/vouchers', { params })
  return z.array(z.unknown()).parse(data.data)
}

export const createDraftVoucher = async (voucher: z.infer<typeof VoucherDraftSchema>) => {
  const { data } = await api.post('/api/v1/vouchers', voucher, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })
  return data.data
}

export const postVoucher = async (id: string) => {
  // Never queueable — fails fast when offline. The caller checks connectivity.
  const { data } = await api.post(`/api/v1/vouchers/${id}/post`)
  return data.data
}

export const reverseVoucher = async (id: string, reason?: string) => {
  const { data } = await api.post(`/api/v1/vouchers/${id}/reverse`, { reason })
  return data.data
}
