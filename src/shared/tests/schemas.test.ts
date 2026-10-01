import { describe, it, expect } from 'vitest'
import {
  VoucherDraftSchema, JournalEntrySchema, AccountSchema, LoginRequestSchema,
} from '../schemas'

describe('schemas', () => {
  it('VoucherDraftSchema accepts a balanced voucher', () => {
    const r = VoucherDraftSchema.safeParse({
      date: '2025-09-15',
      narration: 'Sale',
      voucherType: 'JOURNAL',
      entries: [
        { accountId: 'a', accountType: 'ASSET', debit: 100, credit: 0 },
        { accountId: 'b', accountType: 'REVENUE', debit: 0, credit: 100 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('VoucherDraftSchema rejects an unbalanced voucher', () => {
    const r = VoucherDraftSchema.safeParse({
      date: '2025-09-15',
      narration: 'Bad',
      voucherType: 'JOURNAL',
      entries: [
        { accountId: 'a', accountType: 'ASSET', debit: 100, credit: 0 },
        { accountId: 'b', accountType: 'REVENUE', debit: 0, credit: 99 },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('JournalEntrySchema rejects both debit and credit on one line', () => {
    expect(JournalEntrySchema.safeParse({ accountId: 'a', accountType: 'ASSET', debit: 50, credit: 50 }).success).toBe(false)
  })

  it('AccountSchema rejects a missing name', () => {
    expect(AccountSchema.safeParse({ code: '1200', type: 'ASSET' }).success).toBe(false)
  })

  it('LoginRequestSchema rejects a short password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@b.c', password: 'short' }).success).toBe(false)
  })
})
