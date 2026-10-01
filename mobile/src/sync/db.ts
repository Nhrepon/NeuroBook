// Local SQLite — read cache + write queue, NOT a primary. R21.
import * as SQLite from 'expo-sqlite'

export const db = SQLite.openDatabaseSync('neurobook.db')

export async function initSchema() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      operation TEXT NOT NULL,
      resource TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS sync_queue_created_idx ON sync_queue(created_at);

    -- Read cache (mirrors server; the server is still authoritative).
    CREATE TABLE IF NOT EXISTS accounts_cache (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT,
      type TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS vouchers_cache (
      id TEXT PRIMARY KEY,
      voucher_type TEXT,
      date TEXT,
      narration TEXT,
      status TEXT,
      total_debit INTEGER,
      total_credit INTEGER,
      sequence_number TEXT,
      updated_at INTEGER
    );

    -- Optimistic drafts — UI shows these immediately. server_id is null
    -- until the queue syncs; the queue row keys match the draft id.
    CREATE TABLE IF NOT EXISTS vouchers_drafts (
      id TEXT PRIMARY KEY,
      voucher_type TEXT NOT NULL,
      date TEXT NOT NULL,
      narration TEXT NOT NULL,
      total_debit INTEGER NOT NULL DEFAULT 0,
      total_credit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      server_id TEXT,
      updated_at INTEGER NOT NULL
    );
  `)
}
