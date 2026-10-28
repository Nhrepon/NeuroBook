import { NextRequest } from 'next/server'

export async function POST(_req: NextRequest) {
  const res = Response.json({ data: { revoked: true } })
  res.headers.set('Set-Cookie', 'access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
  return res
}
