import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { ApiError } from '@/controllers/errors'

export async function checkReady() {
  try {
    await db.execute(sql`SELECT 1`)
  } catch (e: any) {
    // Translate the driver's connection error into a typed 503 for the probe.
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', e?.message ?? 'db unavailable')
  }
  return { status: 'ready' }
}
