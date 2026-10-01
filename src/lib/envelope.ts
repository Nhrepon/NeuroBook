// Uniform REST response envelope (§5.11). One shape for success, one for
// error. Applied by every /api/v1/* route handler so the mobile client's
// single error handler covers the whole surface.
import { NextResponse } from 'next/server'
import type { ApiError, ApiResponse } from '@neurobook/shared'

const API_VERSION = 1
const MIN_CLIENT = '0.1.0'
const RECOMMENDED_CLIENT = '0.1.0'

export function ok<T>(data: T, meta?: { cursor?: string; totalCount?: number }): NextResponse {
  const body: ApiResponse<T> = meta ? { data, meta } : { data }
  const res = NextResponse.json(body, { status: 200 })
  applyVersioning(res)
  return res
}

export function created<T>(data: T): NextResponse {
  const body: ApiResponse<T> = { data }
  const res = NextResponse.json(body, { status: 201 })
  applyVersioning(res)
  return res
}

export function err(error: ApiError, status: number): NextResponse {
  const body: ApiResponse<never> = { error }
  const res = NextResponse.json(body, { status })
  applyVersioning(res)
  return res
}

function applyVersioning(res: NextResponse) {
  res.headers.set('X-Api-Version', String(API_VERSION))
  res.headers.set('X-Min-Client-Version', MIN_CLIENT)
  res.headers.set('X-Recommended-Client-Version', RECOMMENDED_CLIENT)
}
