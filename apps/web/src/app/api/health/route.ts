import { getHealth } from '@/controllers/healthController'
import { run } from '@/lib/api/respond'

export async function GET() {
  return run(getHealth)
}
