// Local SQLite cache populated from /api/v1/sync/delta. The server is
// authoritative; this is a read cache + write queue. R21.
import { db } from '@/sync/db'

export interface CachedAccount {
  id: string
  code: string
  name: string
  type: string
  updated_at: number
}

export interface CachedVoucher {
  id: string
  voucher_type: string
  date: string
  narration: string
  status: string
  total_debit: number
  total_credit: number
  sequence_number: string | null
  updated_at: number
}

export async function upsertAccounts(accounts: CachedAccount[]): Promise<void> {
  for (const a of accounts) {
    await db.runAsync(
      `INSERT INTO accounts_cache (id, code, name, type, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         code = excluded.code,
         name = excluded.name,
         type = excluded.type,
         updated_at = excluded.updated_at`,
      [a.id, a.code, a.name, a.type, a.updated_at],
    )
  }
}

export async function upsertVouchers(vouchers: CachedVoucher[]): Promise<void> {
  for (const v of vouchers) {
    await db.runAsync(
      `INSERT INTO vouchers_cache
         (id, voucher_type, date, narration, status, total_debit, total_credit, sequence_number, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         voucher_type = excluded.voucher_type,
         date = excluded.date,
         narration = excluded.narration,
         status = excluded.status,
         total_debit = excluded.total_debit,
         total_credit = excluded.total_credit,
         sequence_number = excluded.sequence_number,
         updated_at = excluded.updated_at`,
      [
        v.id, v.voucher_type, v.date, v.narration, v.status,
        v.total_debit, v.total_credit, v.sequence_number, v.updated_at,
      ],
    )
  }
}

export async function listCachedVouchers(limit = 50): Promise<CachedVoucher[]> {
  return db.getAllAsync<CachedVoucher>(
    `SELECT * FROM vouchers_cache ORDER BY updated_at DESC LIMIT ?`,
    [limit],
  )
}

export async function getCachedVoucher(id: string): Promise<CachedVoucher | null> {
  return (await db.getFirstAsync<CachedVoucher>(
    `SELECT * FROM vouchers_cache WHERE id = ?`,
    [id],
  )) ?? null
}
