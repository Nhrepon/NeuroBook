import { getAuditLog } from '@/controllers/auditController'
import { runEnvelope } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return runEnvelope(getAuditLog)
}