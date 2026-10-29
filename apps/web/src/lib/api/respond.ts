import { toErrorResponse } from '@/controllers/errors'

/** Runs a controller and wraps its plain return value in the API envelope. */
export async function run<T>(fn: () => Promise<T>, init?: ResponseInit): Promise<Response> {
  try {
    return Response.json({ data: await fn() }, init)
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** For controllers that return `{ data, meta }`. */
export async function runEnvelope<T>(fn: () => Promise<{ data: T; meta?: unknown }>, init?: ResponseInit): Promise<Response> {
  try {
    return Response.json(await fn(), init)
  } catch (error) {
    return toErrorResponse(error)
  }
}

/** Reads a JSON body without throwing on malformed input. */
export async function readBody(req: Request): Promise<unknown> {
  return req.json().catch(() => null)
}

function secureSuffix() {
  return process.env.NODE_ENV === 'production' ? '; Secure' : ''
}

/** The `Set-Cookie` value that establishes the 15-minute access-token session. */
export function sessionCookie(token: string): string {
  return `access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${secureSuffix()}`
}

/** The `Set-Cookie` value that clears the access-token session. */
export function clearSessionCookie(): string {
  return `access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureSuffix()}`
}