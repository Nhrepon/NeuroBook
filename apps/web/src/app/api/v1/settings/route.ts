import { NextRequest } from 'next/server'
import { getSettings, saveSettings, updateCompanyPassword } from '@/controllers/settingsController'
import { readBody, run, runEnvelope } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return runEnvelope(getSettings)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => saveSettings(body))
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateCompanyPassword(body))
}