import { ok } from '@/lib/envelope'

export async function GET() {
  return ok({ status: 'ok', timestamp: new Date().toISOString() })
}
