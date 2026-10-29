import { NextRequest } from 'next/server'
import { login } from '@/controllers/authController'
import { toErrorResponse } from '@/controllers/errors'
import { readBody, sessionCookie } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  try {
    const data = await login(body)
    const res = Response.json({ data })
    res.headers.set('Set-Cookie', sessionCookie(data.accessToken))
    return res
  } catch (error) {
    return toErrorResponse(error)
  }
}
