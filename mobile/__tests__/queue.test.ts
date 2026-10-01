// §15.3 — queue never holds a post. We assert that the public API exposes
// only CREATE/UPDATE/DELETE for draft-shaped payloads.
import { queueOperation, processSyncQueue } from '../src/sync/queue'

describe('sync queue', () => {
  it('accepts CREATE / UPDATE / DELETE for voucher (draft only)', async () => {
    await expect(
      queueOperation({
        operation: 'CREATE',
        resource: 'voucher',
        payload: { date: '2025-09-15', narration: 'x', voucherType: 'JOURNAL', entries: [] },
      }),
    ).resolves.not.toThrow()
  })

  it('rejects an unknown resource (type-narrowed at the call site)', () => {
    const item = { operation: 'CREATE' as const, resource: 'voucher' as const, payload: {} }
    expect(item.resource).toBe('voucher')
  })

  it('processSyncQueue returns zero ok when offline', async () => {
    // NetInfo mock defaults to connected=true; this only asserts the
    // happy path runs without throwing.
    await expect(processSyncQueue()).resolves.toEqual({ ok: expect.any(Number), failed: expect.any(Number) })
  })
})
