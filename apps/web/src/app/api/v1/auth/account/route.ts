import { deleteMyAccount } from '@/controllers/authController'
import { clearSessionCookie } from '@/lib/api/respond'
import { toErrorResponse } from '@/controllers/errors'

export const dynamic = 'force-dynamic'

/**
 * Deletes the signed-in person's own account in the current company. Always ends
 * the session, because the token points at a user row that no longer exists.
 */
export async function DELETE() {
  try {
    const data = await deleteMyAccount()
    const res = Response.json({ data })
    res.headers.set('Set-Cookie', clearSessionCookie())
    return res
  } catch (error) {
    return toErrorResponse(error)
  }
}
