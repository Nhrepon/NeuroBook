// /api/v1 — envelope helpers + endpoint index.
// Every /api/v1/* route imports { ok, created, err } from this file (the
// App Router resolves `../route`, `../../route`, … to here depending on
// depth). Next.js only treats exported HTTP-method functions as handlers;
// the other named exports are plain module exports the routes import.
export { ok, created, err } from '@/lib/envelope'

import { ok } from '@/lib/envelope'

// Index of the published REST surface (§5.11). Additive-only within v1.
export async function GET() {
  return ok({
    version: 1,
    endpoints: [
      'POST /api/v1/auth/login',
      'POST /api/v1/auth/refresh',
      'POST /api/v1/auth/logout',
      'GET  /api/v1/accounts',
      'POST /api/v1/accounts',
      'GET  /api/v1/vouchers',
      'POST /api/v1/vouchers',
      'GET  /api/v1/vouchers/:id',
      'PATCH /api/v1/vouchers/:id',
      'POST /api/v1/vouchers/:id/post',
      'POST /api/v1/vouchers/:id/reverse',
      'GET  /api/v1/reports/:type',
      'POST /api/v1/sync',
      'GET  /api/v1/sync/delta',
      'GET  /api/v1/parties',
      'GET  /api/v1/products',
      'GET  /api/v1/reports',
      'GET  /api/v1/users',
    ],
  })
}
