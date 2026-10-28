import * as SQLite from 'expo-sqlite'

let db: SQLite.SQLiteDatabase | null = null

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  db = await SQLite.openDatabaseAsync('neurobook.db')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, code TEXT, type TEXT);
    CREATE TABLE IF NOT EXISTS vouchers (id TEXT PRIMARY KEY, date TEXT, narration TEXT, status TEXT, sequenceNumber TEXT);
    CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, method TEXT, path TEXT, body TEXT, createdAt TEXT);
  `)
  return db
}

export async function cacheAccounts(accounts: { id: string; name: string; code: string; type: string }[]) {
  const d = await getDb()
  await d.runAsync('DELETE FROM accounts')
  for (const a of accounts) {
    await d.runAsync('INSERT INTO accounts (id,name,code,type) VALUES (?,?,?,?)', a.id, a.name, a.code, a.type)
  }
}

export async function listAccounts() {
  const d = await getDb()
  return d.getAllAsync<{ id: string; name: string; code: string; type: string }>('SELECT * FROM accounts')
}

export async function syncOutbox(token: string, apiBase: string) {
  const d = await getDb()
  const rows = await d.getAllAsync<{ id: number; method: string; path: string; body: string }>('SELECT * FROM outbox')
  for (const r of rows) {
    try {
      const res = await fetch(`${apiBase}${r.path}`, {
        method: r.method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: r.body,
      })
      if (res.ok) await d.runAsync('DELETE FROM outbox WHERE id = ?', r.id)
    } catch {
      // keep for retry
    }
  }
}
