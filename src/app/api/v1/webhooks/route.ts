// Webhooks for payment gateway callbacks (Phase 4). Signature verification
// is the implementation gap here.
import { NextRequest } from 'next/server'
import { ok } from '@/lib/envelope'

export async function POST(_req: NextRequest) {
  // Verify the gateway signature, then enqueue a payment/ledger job.
  return ok({ received: true })
}
