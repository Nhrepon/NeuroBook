import { logout } from '@/controllers/authController'
import { clearSessionCookie } from '@/lib/api/respond'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = Response.json({ data: await logout() })
  res.headers.set('Set-Cookie', clearSessionCookie())
  return res
}
