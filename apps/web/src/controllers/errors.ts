import { ForbiddenError } from './scope'

/** Error a controller can throw; routes translate it into an HTTP response. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function badRequest(message: string, code = 'VALIDATION') {
  return new ApiError(400, code, message)
}

export function notFound(message: string) {
  return new ApiError(404, 'NOT_FOUND', message)
}

export function conflict(message: string) {
  return new ApiError(409, 'CONFLICT', message)
}

/**
 * Domain errors raised by shared ledger helpers and the DB repo layer use a
 * `CODE: message` convention. They are mapped here so controllers never have to
 * wrap those calls in `try/catch`.
 */
const DOMAIN_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  IMMUTABLE: 409,
  CONFLICT: 409,
  UNBALANCED: 400,
  PERIOD_LOCKED: 400,
  VALIDATION: 400,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
}

/**
 * Maps a thrown value to the JSON error envelope used by the API. Unknown
 * errors are re-thrown so the framework can log and return a 500.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ForbiddenError) {
    return Response.json({ error: { code: 'FORBIDDEN', message: error.message } }, { status: 403 })
  }
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status })
  }
  if (error instanceof Error) {
    const idx = error.message.indexOf(':')
    const code = idx > 0 ? error.message.slice(0, idx).trim() : ''
    const status = DOMAIN_STATUS[code]
    if (status !== undefined) {
      return Response.json({ error: { code, message: error.message } }, { status })
    }
    // In development, surface unexpected errors instead of an empty 500.
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ error: { code: 'INTERNAL', message: error.message } }, { status: 500 })
    }
  }
  throw error
}
