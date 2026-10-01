// §3.2.1, §15.3. The queue holds draft creates/edits — never posts.
import NetInfo from '@react-native-community/netinfo'
import { db, initSchema } from './db'
import { api } from '@/api/client'

export interface SyncQueueItem {
  id: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  resource: 'voucher' | 'account' | 'payment'
  payload: unknown
  createdAt: number
  retries: number
  lastError?: string
  status: 'pending' | 'failed'
}

// Callers may supply their own `id` so the queue row matches an
// optimistic draft row in `vouchers_drafts` (same clientId).
export type QueueOperationInput = Omit<
  SyncQueueItem,
  'id' | 'createdAt' | 'retries' | 'lastError' | 'status'
> & { id?: string }

const MAX_RETRIES = 5
let inited = false

async function ensureInit() {
  if (inited) return
  await initSchema()
  inited = true
}

export async function queueOperation(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries' | 'lastError' | 'status'> & {
    id?: string
  },
) {
  await ensureInit()
  const id = item.id ?? crypto.randomUUID()
  await db.runAsync(
    `INSERT INTO sync_queue (id, operation, resource, payload, created_at, retries, status)
     VALUES (?, ?, ?, ?, ?, 0, 'pending')`,
    [
      id,
      item.operation,
      item.resource,
      JSON.stringify(item.payload),
      Date.now(),
    ],
  )
  return id
}

export async function pendingCount(): Promise<number> {
  await ensureInit()
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM sync_queue WHERE status = 'pending'`,
  )
  return row?.n ?? 0
}

export async function processSyncQueue(): Promise<{ ok: number; failed: number }> {
  await ensureInit()
  const net = await NetInfo.fetch()
  if (!net.isConnected) return { ok: 0, failed: 0 }

  const pending = await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50`,
  )

  let ok = 0
  let failed = 0
  for (const item of pending) {
    try {
      const endpoint = `/api/v1/${item.resource}s`
      switch (item.operation) {
        case 'CREATE':
          await api.post(endpoint, item.payload, {
            headers: { 'Idempotency-Key': item.id },
          })
          break
        case 'UPDATE':
          await api.patch(
            `${endpoint}/${(item.payload as { id: string }).id}`,
            item.payload,
          )
          break
        case 'DELETE':
          await api.delete(`${endpoint}/${(item.payload as { id: string }).id}`)
          break
      }
      // Mark the optimistic draft as synced (server_id = client-side draft id).
      if (item.resource === 'voucher') {
        await db.runAsync(
          `UPDATE vouchers_drafts SET status = 'synced' WHERE id = ?`,
          [item.id],
        )
      }
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id])
      ok++
    } catch (e) {
      const msg = (e as Error).message
      await db.runAsync(
        `UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?`,
        [msg, item.id],
      )
      if (item.retries + 1 >= MAX_RETRIES) {
        await db.runAsync(
          `UPDATE sync_queue SET status = 'failed' WHERE id = ?`,
          [item.id],
        )
      }
      failed++
    }
  }
  return { ok, failed }
}

// Re-arm on reconnect.
NetInfo.addEventListener((state) => {
  if (state.isConnected) void processSyncQueue()
})
