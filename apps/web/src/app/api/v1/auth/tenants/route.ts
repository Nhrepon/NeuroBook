import { getSwitchableTenants } from '@/controllers/authController'
import { run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getSwitchableTenants)
}
