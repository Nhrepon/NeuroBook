// Readiness probe — O3. Pings the DB.
import { db } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.execute({ sql: 'SELECT 1' } as never)
    return Response.json({ status: 'ready' })
  } catch (e) {
    return Response.json({ status: 'not-ready', error: (e as Error).message }, { status: 503 })
  }
}

// Suppress unused-import warning for sql template until first real usage.
void sql
