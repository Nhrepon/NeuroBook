import { NextRequest } from 'next/server'
import { register } from '@/controllers/authController'
import { toErrorResponse } from '@/controllers/errors'
import { readBody, sessionCookie } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await readBody(req)
  try {
    const data = await register(body)
    const res = Response.json({ data }, { status: 201 })
    res.headers.set('Set-Cookie', sessionCookie(data.accessToken))
    return res
  } catch (error) {
    return toErrorResponse(error)
  }
}
