import { NextRequest } from 'next/server'
import { createTenant, deleteTenant, getAllTenants, updateTenantPassword } from '@/controllers/tenantController'
import { toErrorResponse } from '@/controllers/errors'
import { clearSessionCookie, readBody, run } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function GET() {
  return run(getAllTenants)
}

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  return run(() => createTenant(body), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await readBody(req)
  return run(() => updateTenantPassword(body))
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  try {
    const data = await deleteTenant(id)
    const res = Response.json({ data })
    if (data.sessionEnded) {
      res.headers.set('Set-Cookie', clearSessionCookie())
    }
    return res
  } catch (error) {
    return toErrorResponse(error)
  }
}
