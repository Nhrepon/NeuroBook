import { checkReady } from '@/controllers/readyController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(checkReady)
}
