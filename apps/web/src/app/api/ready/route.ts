import { db } from '@/db/client'
import { sql } from 'drizzle-orm'
import { ok, err } from '@/lib/envelope'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return ok({ status: 'ready' })
  } catch (e: any) {
    return err({ code: 'SERVICE_UNAVAILABLE', message: e?.message ?? 'db unavailable' }, 503)
  }
}
