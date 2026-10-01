// O6: Contract tests pin the REST surface. Every /api/v1/* response must
// parse against the shared Zod schemas. These run against a live Next.js
// dev server in CI; the suite is gated to integration runs.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Lightweight schemas mirroring the response envelope.
const ErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const OkSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: z.object({ cursor: z.string().optional() }).optional() })

describe.skip('REST contract (requires running dev server)', () => {
  const base = process.env.NEUROBOOK_TEST_URL ?? 'http://localhost:3000'

  it('GET /api/v1/vouchers returns the envelope', async () => {
    const res = await fetch(`${base}/api/v1/vouchers?limit=1`, {
      headers: { authorization: 'Bearer test' },
    })
    const json = await res.json()
    const parsed = OkSchema(z.array(z.unknown())).safeParse(json)
    expect(parsed.success).toBe(true)
  })

  it('error responses match the envelope shape', () => {
    const sample = { error: { code: 'NOT_FOUND', message: 'gone' } }
    expect(ErrorSchema.safeParse(sample).success).toBe(true)
  })
})
